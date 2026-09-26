import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { dump } from "js-yaml";
import { parameterValueToString } from "./parameter-normalizer.js";
import { parseConfig } from "./config-parser.js";
import { RULE_SOURCE, type PermissionRuleRecord } from "./types.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Create a narrow rule for the exact arguments the user approved. Matching
 * these values as escaped, anchored regexes avoids accidentally broad grants.
 */
/**
 * Creates a rule that precisely allows the specific arguments provided.
 * This is used when a user selects "Allow once" or a persistent "Allow" option.
 * The patterns are created as anchored regexes to avoid accidental broad grants.
 */
export function createAllowRule(
  tool: string,
  parameters: Record<string, unknown>,
  priority: number,
): PermissionRuleRecord {

  const patterns: Record<string, string> = {};
  for (const [key, value] of Object.entries(parameters)) {
    patterns[key] = `^${escapeRegExp(parameterValueToString(value))}$`;
  }

  return {
    tool,
    parameters: patterns,
    policy: "allow",
    priority,
  };
}

/** Append a validated rule without discarding existing or extension-owned keys. */
/** Atomic persistence: write to temp file then rename to avoid partial reads. */
/**
 * Atomically persists a permission rule to a YAML file.
 * Uses a temporary file and rename operation to prevent corrupting the config file.
 */
export function appendPermissionRule(path: string, rule: PermissionRuleRecord): void {

  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });

  let existing: Record<string, unknown>[] = [];
  if (existsSync(path)) {
    const raw = readFileSync(path, "utf8");
    try {
      existing = parseConfig(raw, path);
    } catch (error) {
      console.error(`Invalid permissions config ${path}:`, error);
      process.exit(1);
    }
  }

  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;

  try {
    writeFileSync(temporaryPath, dump([...existing, rule]), {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, path);
  } catch (error) {
    try {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    } catch {
      // Preserve the original persistence error.
    }
    throw error;
  }
}
