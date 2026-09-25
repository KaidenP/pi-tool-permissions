import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { getConfigPaths, getRuleSource, loadConfig, } from "./config-parser.js";
import { resolveRules } from "./match-engine.js";
import { normalizeToolParams } from "./parameter-normalizer.js";
import { logDecision } from "./log.js";
import { createAllowRule } from "./persistence.js";
import { policyRegistryInstance, POLICY_REGISTRATION_EVENT, } from "./policy-registry.js";
import { promptRendererInstance, } from "./prompt-registry.js";
import { PROMPT_CHOICES, resolveChoice, makePromptTitle, priorityForNewAllowRule, denied } from "./prompt-builder.js";
import { persistChoice } from "./middleware/persistence.js";
import "./renderers/edit.js";
import "./renderers/read.js";
import "./renderers/bash.js";
import "./renderers/write.js";
export { PolicyRegistry, policyRegistryInstance, POLICY_REGISTRATION_EVENT, registerPolicy, } from "./policy-registry.js";
export { registerPromptRenderer, promptRendererInstance } from "./prompt-registry.js";
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
/**
 * Create the tool-call middleware. Session-only rules for ephemeral sessions
 * are deliberately scoped to this handler instance and cannot leak to another
 * session after a reload or session switch.
 */
export function createPermissionHandler(options = {}) {
    const registry = options.registry ?? policyRegistryInstance;
    const logger = options.logger ?? logDecision;
    const sessionRulesInMemory = [];
    return async (event, ctx) => {
        let logSource = "permission-middleware";
        try {
            const toolName = event.toolName;
            // Use Pi's event guard for typed access. A failed guard is a fail-closed
            // condition, never a reason to let the tool call through.
            if (!isToolCallEventType(toolName, event)) {
                logger(toolName, "Denied", "unrecognized-tool-call-event");
                return denied("Unable to inspect tool call for permission evaluation");
            }
            if (!isRecord(event.input)) {
                logger(event.toolName, "Denied", "invalid-tool-input");
                return denied("Tool arguments were not a valid object");
            }
            const cwd = ctx.cwd || process.cwd();
            const normalizedParameters = normalizeToolParams(event.toolName, event.input, cwd);
            const sessionFile = ctx.sessionManager.getSessionFile();
            const paths = getConfigPaths(cwd, sessionFile, options.homeDir ?? homedir());
            const globalRules = loadConfig(paths.global);
            // Project permission files can grant execution. Do not honor project
            // configuration until Pi has resolved trust for the current project.
            const projectTrusted = ctx.isProjectTrusted();
            const projectRules = projectTrusted ? loadConfig(paths.project) : [];
            const projectLocalRules = projectTrusted ? loadConfig(paths.projectLocal) : [];
            const sessionRules = paths.session ? loadConfig(paths.session) : [];
            // Scope order: global, project, project-local, session + in-memory ephemerals.
            const scopes = [
                globalRules,
                projectRules,
                projectLocalRules,
                [...sessionRules, ...sessionRulesInMemory],
            ];
            const winningRule = resolveRules(scopes, event.toolName, normalizedParameters, cwd);
            logSource = getRuleSource(winningRule) ?? (winningRule.virtual ? "<default ask>" : "<configuration>");
            const policyDecision = await registry.resolve(winningRule.policy, winningRule.priority ?? 0, {
                rule: winningRule,
                event,
                extensionContext: ctx,
                cwd,
                parameters: normalizedParameters,
            });
            if (policyDecision.decision === "deny") {
                logger(event.toolName, "Denied", logSource);
                return denied(`Denied by permission policy "${winningRule.policy}"`);
            }
            if (policyDecision.decision === "allow") {
                logger(event.toolName, "Allowed", logSource);
                return { block: false };
            }
            // Unknown/custom decision strings are treated as ask, so custom policies
            // cannot accidentally bypass the user-consent path.
            logger(event.toolName, "Asked", logSource);
            if (!ctx.hasUI) {
                logger(event.toolName, "Denied", `${logSource} (no UI available)`);
                return denied("No UI is available to approve this tool call");
            }
            const customRenderer = promptRendererInstance.lookup(event.toolName);
            let promptTitle = makePromptTitle(event.toolName, event.input);
            if (customRenderer) {
                try {
                    promptTitle = await customRenderer(event, normalizedParameters);
                }
                catch (e) {
                    console.error("Custom prompt renderer failed:", e);
                }
            }
            const choice = await ctx.ui.select(promptTitle, [...PROMPT_CHOICES]);
            const selectedChoice = choice;
            const result = selectedChoice ? resolveChoice(selectedChoice) : { action: "deny" };
            if (result.action === "deny") {
                logger(event.toolName, "Denied", "user-denied");
                return denied("Permission denied by user");
            }
            if (result.action === "allow-once") {
                logger(event.toolName, "Allowed", "user-once");
                return { block: false };
            }
            const rule = createAllowRule(event.toolName, normalizedParameters, priorityForNewAllowRule(winningRule));
            let persistedTo = "";
            try {
                const persistenceResult = persistChoice(result, paths, rule, sessionRulesInMemory, projectTrusted);
                persistedTo = persistenceResult.persistedTo;
                if (persistenceResult.needsMemory && persistenceResult.memorySource) {
                    const memorySource = persistenceResult.memorySource;
                    try {
                        if (ctx.hasUI) {
                            ctx.ui.notify("Saved the project grant. It applies for this session; Pi project trust is required to honor it after restart.", "warning");
                        }
                    }
                    catch (error) {
                        console.error("Could not notify about pending project trust:", error);
                    }
                }
            }
            catch (error) {
                console.error("Failed to persist permission rule:", error);
                if (ctx.hasUI) {
                    ctx.ui.notify("Could not save this permission; allowing this call once only.", "warning");
                }
                logger(event.toolName, "Allowed", "user-once (persistence failed)");
                return { block: false };
            }
            logger(event.toolName, "Allowed", persistedTo);
            return { block: false };
        }
        catch (error) {
            console.error("Permission middleware error:", error);
            try {
                logger(event.toolName, "Denied", logSource);
            }
            catch (loggingError) {
                console.error("Failed to record permission middleware error:", loggingError);
            }
            return denied("Permission middleware error; tool call blocked");
        }
    };
}
export default function (pi) {
    const unregisterPolicies = [];
    const removePolicyListener = pi.events.on(POLICY_REGISTRATION_EVENT, (registration) => {
        if (!isRecord(registration) ||
            typeof registration.key !== "string" ||
            typeof registration.handler !== "function") {
            console.error(`Ignored invalid policy registration on ${POLICY_REGISTRATION_EVENT}`);
            return;
        }
        try {
            unregisterPolicies.push(policyRegistryInstance.register(registration.key, registration.handler));
        }
        catch (error) {
            console.error("Failed to register permission policy:", error);
        }
    });
    pi.on("session_shutdown", () => {
        removePolicyListener();
        for (const unregister of unregisterPolicies.splice(0))
            unregister();
    });
    pi.on("tool_call", createPermissionHandler());
}
