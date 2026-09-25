import { load } from "js-yaml";
import { readFileSync, existsSync } from "fs";
import { resolve, normalize } from "path";
import { realpathSync } from "fs";
import { Type } from "typebox";
import { Check } from "typebox/schema";
import { PermissionRuleSchema } from "./schemas";
import { homedir } from "os";
import { join } from "path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";

export function loadConfig(path: string): any {
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    console.error("Failed to read config:", path);
    process.exit(1);
  }
  let parsed: any;
  try {
    parsed = load(raw);
  } catch (e) {
    console.error("YAML decode failure:", e);
    process.exit(1);
  }
  if (!Array.isArray(parsed)) {
    console.error("Invalid config: must be array");
    process.exit(1);
  }
  const rules: any[] = [];
  for (const item of parsed) {
    if (item && typeof item === "object") {
      // Ignore extra keys automatically by selecting only schema keys via TypeBox validation
      if (!Check(PermissionRuleSchema, item)) {
        console.error("Invalid config rule (TypeBox validation failed):", item);
        process.exit(1);
      }
      const cleaned: any = {};
      for (const [k, v] of Object.entries(PermissionRuleSchema.properties)) {
        if (k in item) cleaned[k] = item[k];
      }
      cleaned.priority = item.priority ?? 0;
      rules.push(cleaned);
    }
  }
  return rules;
}

export function getConfigPaths(cwd: string, sessionFile?: string) {
  return {
    global: join(homedir(), CONFIG_DIR_NAME, "agent", "permissions.yaml"),
    project: join(cwd, CONFIG_DIR_NAME, "permissions.yaml"),
    projectLocal: join(cwd, CONFIG_DIR_NAME, "permissions.local.yaml"),
    session: sessionFile ? sessionFile.replace(/\.jsonl$/, ".permissions.yaml") : undefined,
  };
}

export function normalizePath(p: string, cwd?: string): string {
  try {
    const resolved = resolve(cwd || ".", p);
    const real = realpathSync(resolved);
    return normalize(real);
  } catch {
    return normalize(p);
  }
}

export function interpolatePattern(pattern: string, cwd?: string, home?: string): string {
  const h = home || homedir();
  return pattern.replace(/\$\{CWD\}/g, cwd || ".").replace(/\$\{HOME\}/g, h);
}

export function matchRule(rule: any, toolName: string, params: any, cwd?: string): boolean {
  if (rule.tool !== toolName) return false;
  const parameters = rule.parameters || {};
  for (const [key, regexStr] of Object.entries(parameters)) {
    if (!(key in params)) return false;
    const regex = new RegExp(interpolatePattern(String(regexStr), cwd));
    if (!regex.test(String(params[key]))) return false;
  }
  return true;
}

export function resolveRules(rulesList: any[][], toolName: string, params: any, cwd?: string): any | null {
  const all = rulesList.flat();
  const matches = all.filter((r) => matchRule(r, toolName, params, cwd));
  if (matches.length === 0) return { policy: "ask", priority: 0, virtual: true };
  const maxPriority = Math.max(...matches.map((r) => r.priority ?? 0));
  const topMatches = matches.filter((r) => (r.priority ?? 0) === maxPriority);
  // Tie: last entry wins (most local scope loaded last)
  return topMatches[topMatches.length - 1];
}
