import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { policyRegistryInstance } from "./policy-registry.js";
import { loadConfig, getConfigPaths, resolveRules, normalizePath } from "./config-loader.js";
import { logDecision } from "./log.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { load, dump } from "js-yaml";
const registry = policyRegistryInstance;
// In-memory session rules for ephemeral sessions
const sessionRulesInMemory = [];
function persistRule(scopePath, rule) {
    try {
        const dir = scopePath.substring(0, scopePath.lastIndexOf("/") || scopePath.lastIndexOf("\\"));
        if (dir && !existsSync(dir))
            mkdirSync(dir, { recursive: true });
        let arr = [];
        if (existsSync(scopePath)) {
            const content = readFileSync(scopePath, "utf8");
            const parsed = load(content);
            if (Array.isArray(parsed))
                arr = parsed;
        }
        arr.push(rule);
        writeFileSync(scopePath, dump(arr));
    }
    catch (e) {
        console.error("Failed to persist rule:", e);
    }
}
export default function (pi) {
    pi.on("tool_call", async (event, ctx) => {
        try {
            if (!isToolCallEventType(event.toolName, event)) {
                return { block: false };
            }
            const cwd = ctx.cwd || process.cwd();
            const sessionFile = ctx.sessionManager?.getSessionFile?.();
            const paths = getConfigPaths(cwd, sessionFile);
            const scopes = [
                loadConfig(paths.global),
                loadConfig(paths.project),
                loadConfig(paths.projectLocal),
                (sessionFile && paths.session) ? loadConfig(paths.session) : sessionRulesInMemory,
            ];
            const paramsRaw = event.input || {};
            const normalizedParams = {};
            for (const [k, v] of Object.entries(paramsRaw)) {
                if (typeof v === "string") {
                    normalizedParams[k] = normalizePath(v, cwd);
                }
                else {
                    normalizedParams[k] = v;
                }
            }
            const winningRule = resolveRules(scopes, event.toolName, normalizedParams, cwd);
            const decision = await registry.resolve(winningRule);
            if (decision.decision === "deny") {
                const source = winningRule?.source || (winningRule ? "config" : "default-deny");
                logDecision(event.toolName, "Denied", source);
                return { block: true, reason: "Denied by permission policy", terminate: true };
            }
            if (decision.decision === "ask") {
                if (!ctx.hasUI) {
                    logDecision(event.toolName, "Denied (no UI)", "default");
                    return { block: true, reason: "No UI available - default deny for ask", terminate: true };
                }
                const labels = [
                    "Allow once",
                    "Allow only in this session",
                    "Allow always (Project-local)",
                    "Allow always (Project)",
                    "Allow always (Global)",
                ];
                const choiceLabel = await ctx.ui.select("Permission", labels) || "";
                const choiceIndex = labels.indexOf(choiceLabel);
                if (choiceIndex === 0) {
                    logDecision(event.toolName, "Allowed", "user-once");
                    return { block: false };
                }
                const rule = { tool: event.toolName, parameters: normalizedParams, policy: "allow", priority: 0 };
                if (choiceIndex === 1) {
                    if (paths.session) {
                        persistRule(paths.session, rule);
                        logDecision(event.toolName, "Allowed", paths.session || "session-persisted");
                    }
                    else {
                        sessionRulesInMemory.push(rule);
                        logDecision(event.toolName, "Allowed", "session-memory");
                    }
                }
                else if (choiceIndex === 2) {
                    persistRule(paths.projectLocal, rule);
                    logDecision(event.toolName, "Allowed", paths.projectLocal);
                }
                else if (choiceIndex === 3) {
                    persistRule(paths.project, rule);
                    logDecision(event.toolName, "Allowed", paths.project);
                }
                else if (choiceIndex === 4) {
                    persistRule(paths.global, rule);
                    logDecision(event.toolName, "Allowed", paths.global);
                }
                else {
                    logDecision(event.toolName, "Denied", "user-cancelled");
                    return { block: true, reason: "Denied by user", terminate: true };
                }
                return { block: false };
            }
            if (decision.decision === "allow") {
                const source = winningRule?.source || (winningRule ? "config" : "default");
                logDecision(event.toolName, "Allowed", source);
                return { block: false };
            }
            // Unknown policy fallback to ask
            if (!ctx.hasUI) {
                logDecision(event.toolName, "Denied (no UI)", "unknown-policy");
                return { block: true, reason: "Unknown policy and no UI", terminate: true };
            }
            const ok = await ctx.ui.confirm("Permission", `Unknown policy for ${event.toolName}. Allow once?`);
            if (!ok) {
                logDecision(event.toolName, "Denied", "user");
                return { block: true, reason: "Denied by user", terminate: true };
            }
            logDecision(event.toolName, "Allowed", "user-unknown-policy");
            return { block: false };
        }
        catch (e) {
            console.error("Permission middleware error:", e);
            return { block: true, reason: "Permission middleware error", terminate: true };
        }
    });
}
