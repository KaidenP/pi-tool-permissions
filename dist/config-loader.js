"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.getConfigPaths = getConfigPaths;
exports.normalizePath = normalizePath;
exports.interpolatePattern = interpolatePattern;
exports.matchRule = matchRule;
exports.resolveRules = resolveRules;
const js_yaml_1 = require("js-yaml");
const fs_1 = require("fs");
const path_1 = require("path");
const fs_2 = require("fs");
const schema_1 = require("typebox/schema");
const schemas_1 = require("./schemas");
const os_1 = require("os");
const path_2 = require("path");
const pi_coding_agent_1 = require("@earendil-works/pi-coding-agent");
function loadConfig(path) {
    if (!(0, fs_1.existsSync)(path))
        return [];
    let raw;
    try {
        raw = (0, fs_1.readFileSync)(path, "utf8");
    }
    catch (e) {
        console.error("Failed to read config:", path);
        process.exit(1);
    }
    let parsed;
    try {
        parsed = (0, js_yaml_1.load)(raw);
    }
    catch (e) {
        console.error("YAML decode failure:", e);
        process.exit(1);
    }
    if (!Array.isArray(parsed)) {
        console.error("Invalid config: must be array");
        process.exit(1);
    }
    const rules = [];
    for (const item of parsed) {
        if (item && typeof item === "object") {
            // Ignore extra keys automatically by selecting only schema keys via TypeBox validation
            if (!(0, schema_1.Check)(schemas_1.PermissionRuleSchema, item)) {
                console.error("Invalid config rule (TypeBox validation failed):", item);
                process.exit(1);
            }
            const cleaned = {};
            const anyItem = item;
            for (const [k, v] of Object.entries(schemas_1.PermissionRuleSchema.properties)) {
                if (k in anyItem)
                    cleaned[k] = anyItem[k];
            }
            cleaned.priority = anyItem.priority ?? 0;
            rules.push(cleaned);
        }
    }
    return rules;
}
function getConfigPaths(cwd, sessionFile) {
    return {
        global: (0, path_2.join)((0, os_1.homedir)(), pi_coding_agent_1.CONFIG_DIR_NAME, "agent", "permissions.yaml"),
        project: (0, path_2.join)(cwd, pi_coding_agent_1.CONFIG_DIR_NAME, "permissions.yaml"),
        projectLocal: (0, path_2.join)(cwd, pi_coding_agent_1.CONFIG_DIR_NAME, "permissions.local.yaml"),
        session: sessionFile ? sessionFile.replace(/\.jsonl$/, ".permissions.yaml") : undefined,
    };
}
function normalizePath(p, cwd) {
    try {
        const resolved = (0, path_1.resolve)(cwd || ".", p);
        const real = (0, fs_2.realpathSync)(resolved);
        return (0, path_1.normalize)(real);
    }
    catch {
        return (0, path_1.normalize)(p);
    }
}
function interpolatePattern(pattern, cwd, home) {
    const h = home || (0, os_1.homedir)();
    return pattern.replace(/\$\{CWD\}/g, cwd || ".").replace(/\$\{HOME\}/g, h);
}
function matchRule(rule, toolName, params, cwd) {
    if (rule.tool !== toolName)
        return false;
    const parameters = rule.parameters || {};
    for (const [key, regexStr] of Object.entries(parameters)) {
        if (!(key in params))
            return false;
        const regex = new RegExp(interpolatePattern(String(regexStr), cwd));
        if (!regex.test(String(params[key])))
            return false;
    }
    return true;
}
function resolveRules(rulesList, toolName, params, cwd) {
    const all = rulesList.flat();
    const matches = all.filter((r) => matchRule(r, toolName, params, cwd));
    if (matches.length === 0)
        return { policy: "ask", priority: 0, virtual: true };
    const maxPriority = Math.max(...matches.map((r) => r.priority ?? 0));
    const topMatches = matches.filter((r) => (r.priority ?? 0) === maxPriority);
    // Tie: last entry wins (most local scope loaded last)
    return topMatches[topMatches.length - 1];
}
