import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { Check } from "typebox/schema";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { PermissionRuleSchema } from "./schemas.js";
import { RULE_SOURCE } from "./types.js";
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function failConfig(path, error) {
    console.error(`Invalid permissions config ${path}:`, error);
    process.exit(1);
}
export function parseConfig(raw, path = "<permissions>") {
    const hasContentLine = raw
        .split(/\r?\n/)
        .some((line) => line.trim().length > 0 && !line.trimStart().startsWith("#"));
    if (!hasContentLine)
        return [];
    let parsed;
    try {
        parsed = load(raw);
    }
    catch (error) {
        throw new Error(`YAML decode failure in ${path}: ${String(error)}`, { cause: error });
    }
    if (parsed === undefined)
        return [];
    if (!Array.isArray(parsed)) {
        throw new Error(`Invalid config ${path}: the document must be an array of rules`);
    }
    return parsed.map((item, index) => {
        if (!isRecord(item) || !Check(PermissionRuleSchema, item)) {
            throw new Error(`Invalid rule ${index + 1} in ${path}: each rule must have valid string "tool" and "policy" keys`);
        }
        return { ...item };
    });
}
export function loadConfig(path) {
    if (!existsSync(path))
        return [];
    let raw;
    try {
        raw = readFileSync(path, "utf8");
    }
    catch (error) {
        return failConfig(path, error);
    }
    let parsed;
    try {
        parsed = parseConfig(raw, path);
    }
    catch (error) {
        return failConfig(path, error);
    }
    return parsed.map((item) => {
        const rule = { ...item, priority: item.priority ?? 0 };
        Object.defineProperty(rule, RULE_SOURCE, {
            value: path,
            enumerable: false,
            configurable: false,
        });
        return rule;
    });
}
export function getConfigPaths(cwd, sessionFile, homeDir = homedir()) {
    const session = sessionFile?.endsWith(".jsonl")
        ? sessionFile.slice(0, -".jsonl".length) + ".permissions.yaml"
        : undefined;
    return {
        global: join(homeDir, CONFIG_DIR_NAME, "agent", "permissions.yaml"),
        project: join(cwd, CONFIG_DIR_NAME, "permissions.yaml"),
        projectLocal: join(cwd, CONFIG_DIR_NAME, "permissions.local.yaml"),
        session,
    };
}
export function getRuleSource(rule) {
    return rule?.[RULE_SOURCE];
}
export function setRuleSource(rule, source) {
    Object.defineProperty(rule, RULE_SOURCE, {
        value: source,
        enumerable: false,
        configurable: true,
    });
}
