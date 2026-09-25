"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const pi_coding_agent_1 = require("@earendil-works/pi-coding-agent");
const policy_registry_1 = require("./policy-registry");
const config_loader_1 = require("./config-loader");
const log_1 = require("./log");
const path_1 = require("path");
const fs_1 = require("fs");
const js_yaml_1 = require("js-yaml");
const registry = new policy_registry_1.PolicyRegistry();
function persistRule(scopePath, rule) {
    try {
        const dir = scopePath.substring(0, scopePath.lastIndexOf("/") || scopePath.lastIndexOf("\\"));
        if (dir && !(0, fs_1.existsSync)(dir))
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        let arr = [];
        if ((0, fs_1.existsSync)(scopePath)) {
            const content = (0, fs_1.readFileSync)(scopePath, "utf8");
            const parsed = (0, js_yaml_1.load)(content);
            if (Array.isArray(parsed))
                arr = parsed;
        }
        arr.push(rule);
        (0, fs_1.writeFileSync)(scopePath, (0, js_yaml_1.dump)(arr));
    }
    catch (e) {
        console.error("Failed to persist rule:", e);
    }
}
function default_1(pi) {
    pi.on("tool_call", async (event, ctx) => {
        try {
            if (!(0, pi_coding_agent_1.isToolCallEventType)(event.toolName, event)) {
                return { block: false };
            }
            const cwd = ctx.cwd || process.cwd();
            const sessionFile = ctx.sessionManager?.getSessionFile?.();
            const paths = (0, config_loader_1.getConfigPaths)(cwd, sessionFile);
            const scopes = [
                (0, config_loader_1.loadConfig)(paths.global),
                (0, config_loader_1.loadConfig)(paths.project),
                (0, config_loader_1.loadConfig)(paths.projectLocal),
                sessionFile && paths.session ? (0, config_loader_1.loadConfig)(paths.session) : [],
            ];
            const paramsRaw = event.input || {};
            const normalizedParams = {};
            for (const [k, v] of Object.entries(paramsRaw)) {
                if (typeof v === "string") {
                    normalizedParams[k] = (0, config_loader_1.normalizePath)(v, cwd);
                }
                else {
                    normalizedParams[k] = v;
                }
            }
            const winningRule = (0, config_loader_1.resolveRules)(scopes, event.toolName, normalizedParams, cwd);
            const decision = await registry.resolve(winningRule);
            if (decision.decision === "deny") {
                (0, log_1.logDecision)(event.toolName, "Denied", winningRule ? "config" : "default-deny");
                return { block: true, reason: "Denied by permission policy", terminate: true };
            }
            if (decision.decision === "ask") {
                if (!ctx.hasUI) {
                    (0, log_1.logDecision)(event.toolName, "Denied (no UI)", "default");
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
                    (0, log_1.logDecision)(event.toolName, "Allowed", "user-once");
                    return { block: false };
                }
                const rule = { tool: event.toolName, parameters: normalizedParams, policy: "allow", priority: 0 };
                if (choiceIndex === 1) {
                    const sp = paths.session || (0, path_1.join)(cwd, pi_coding_agent_1.CONFIG_DIR_NAME, ".permissions.yaml");
                    persistRule(sp, rule);
                    (0, log_1.logDecision)(event.toolName, "Allowed", "session-persisted");
                }
                else if (choiceIndex === 2) {
                    persistRule(paths.projectLocal, rule);
                    (0, log_1.logDecision)(event.toolName, "Allowed", "project-local-persisted");
                }
                else if (choiceIndex === 3) {
                    persistRule(paths.project, rule);
                    (0, log_1.logDecision)(event.toolName, "Allowed", "project-persisted");
                }
                else if (choiceIndex === 4) {
                    persistRule(paths.global, rule);
                    (0, log_1.logDecision)(event.toolName, "Allowed", "global-persisted");
                }
                else {
                    (0, log_1.logDecision)(event.toolName, "Denied", "user-cancelled");
                    return { block: true, reason: "Denied by user", terminate: true };
                }
                return { block: false };
            }
            if (decision.decision === "allow") {
                (0, log_1.logDecision)(event.toolName, "Allowed", winningRule ? "config" : "default");
                return { block: false };
            }
            // Unknown policy fallback to ask
            if (!ctx.hasUI) {
                (0, log_1.logDecision)(event.toolName, "Denied (no UI)", "unknown-policy");
                return { block: true, reason: "Unknown policy and no UI", terminate: true };
            }
            const ok = await ctx.ui.confirm("Permission", `Unknown policy for ${event.toolName}. Allow once?`);
            if (!ok) {
                (0, log_1.logDecision)(event.toolName, "Denied", "user");
                return { block: true, reason: "Denied by user", terminate: true };
            }
            (0, log_1.logDecision)(event.toolName, "Allowed", "user-unknown-policy");
            return { block: false };
        }
        catch (e) {
            console.error("Permission middleware error:", e);
            return { block: true, reason: "Permission middleware error", terminate: true };
        }
    });
}
