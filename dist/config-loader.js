import { load } from "js-yaml";
import { readFileSync, existsSync } from "fs";
import { resolve, normalize } from "path";
import { realpathSync } from "fs";
import { Check } from "typebox/schema";
import { PermissionRuleSchema } from "./schemas.js";
import { homedir } from "os";
import { join } from "path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
export function loadConfig(path) {
    if (!existsSync(path))
        return [];
    let raw;
    try {
        raw = readFileSync(path, "utf8");
    }
    catch (e) {
        console.error("Failed to read config:", path);
        process.exit(1);
    }
    // Handle empty or whitespace-only files gracefully
    if (raw.trim().length === 0)
        return [];
    let parsed;
    try {
        parsed = load(raw);
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
            if (!Check(PermissionRuleSchema, item)) {
                console.error("Invalid config rule (TypeBox validation failed):", item);
                process.exit(1);
            }
            // Preserve all original keys (including extra/unknown keys) so future extensions can use them
            const preserved = { ...item };
            preserved.priority = item.priority ?? 0;
            // Annotate with source file for logging, but don't persist it
            preserved.source = path;
            rules.push(preserved);
        }
    }
    return rules;
}
export function getConfigPaths(cwd, sessionFile) {
    return {
        global: join(homedir(), CONFIG_DIR_NAME, "agent", "permissions.yaml"),
        project: join(cwd, CONFIG_DIR_NAME, "permissions.yaml"),
        projectLocal: join(cwd, CONFIG_DIR_NAME, "permissions.local.yaml"),
        session: sessionFile ? sessionFile.replace(/\.jsonl$/, ".permissions.yaml") : undefined,
    };
}
export function normalizePath(p, cwd) {
    try {
        const resolved = resolve(cwd || ".", p);
        const real = realpathSync(resolved);
        return normalize(real);
    }
    catch {
        return normalize(p);
    }
}
export function interpolatePattern(pattern, cwd, home) {
    const h = home || homedir();
    return pattern.replace(/\$\{CWD\}/g, cwd || ".").replace(/\$\{HOME\}/g, h);
}
export function matchRule(rule, toolName, params, cwd) {
    if (rule.tool !== toolName)
        return false;
    const parameters = rule.parameters || {};
    for (const [key, regexStr] of Object.entries(parameters)) {
        if (!(key in params))
            return false;
        try {
            const regex = new RegExp(interpolatePattern(String(regexStr), cwd));
            if (!regex.test(String(params[key])))
                return false;
        }
        catch (e) {
            // Invalid regex pattern: treat as non-match for robustness
            return false;
        }
    }
    return true;
}
export function resolveRules(rulesList, toolName, params, cwd) {
    const all = rulesList.flat();
    const matches = all.filter((r) => matchRule(r, toolName, params, cwd));
    if (matches.length === 0)
        return { policy: "ask", priority: 0, virtual: true };
    const maxPriority = Math.max(...matches.map((r) => r.priority ?? 0));
    const topMatches = matches.filter((r) => (r.priority ?? 0) === maxPriority);
    // Tie: last entry wins (most local scope loaded last)
    return topMatches[topMatches.length - 1];
}
