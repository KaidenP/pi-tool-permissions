import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { Check } from "typebox/schema";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { PermissionRuleSchema } from "./schemas.js";

/** Non-serializing metadata used to report which file supplied a rule. */
export const RULE_SOURCE = Symbol("permission-rule-source");

export type PermissionRuleRecord = Record<string, unknown> & {
  tool: string;
  policy: string;
  priority: number;
  parameters?: Record<string, string>;
  virtual?: boolean;
  [RULE_SOURCE]?: string;
};

const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const BUILTIN_PATH_PARAMETERS: Record<string, ReadonlySet<string>> = {
  read: new Set(["path"]),
  edit: new Set(["path"]),
  write: new Set(["path"]),
  grep: new Set(["path"]),
  find: new Set(["path"]),
  ls: new Set(["path"]),
};
const PATH_PARAMETER_NAMES = new Set([
  "path",
  "paths",
  "file",
  "files",
  "filepath",
  "filepaths",
  "directory",
  "directories",
  "dir",
  "dirs",
  "cwd",
  "workdir",
  "workingdirectory",
]);
const REGEX_META = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"]);
const REGEX_ESCAPABLE = new Set(["\\", ...REGEX_META, "/"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Fail-closed: malformed permission files block rather than allow. */
function failConfig(path: string, error: unknown): never {
  console.error(`Invalid permissions config ${path}:`, error);
  process.exit(1);
}

/**
 * Parse and validate the YAML document without changing rule fields. Unknown
 * keys are intentionally kept so policy extensions can consume them.
 */
export function parseConfig(raw: string, path = "<permissions>"): Record<string, unknown>[] {
  // js-yaml throws for an empty input before returning its usual `undefined`
  // value, so handle whitespace-only and comments-only files explicitly.
  const hasContentLine = raw
    .split(/\r?\n/)
    .some((line) => line.trim().length > 0 && !line.trimStart().startsWith("#"));
  if (!hasContentLine) return [];

  let parsed: unknown;
  try {
    parsed = load(raw);
  } catch (error) {
    throw new Error(`YAML decode failure in ${path}: ${String(error)}`, { cause: error });
  }

  // A comments-only YAML document is also semantically empty.
  if (parsed === undefined) return [];
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid config ${path}: the document must be an array of rules`);
  }

  return parsed.map((item, index) => {
    if (!isRecord(item) || !Check(PermissionRuleSchema, item)) {
      throw new Error(
        `Invalid rule ${index + 1} in ${path}: each rule must have valid string "tool" and "policy" keys`,
      );
    }
    // Copy, but never project onto the schema: doing so would discard keys
    // intended for third-party policy handlers.
    return { ...item };
  });
}

/** Load and validate one permission file. Invalid files fail closed. */
export function loadConfig(path: string): PermissionRuleRecord[] {
  if (!existsSync(path)) return [];

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    return failConfig(path, error);
  }

  let parsed: Record<string, unknown>[];
  try {
    parsed = parseConfig(raw, path);
  } catch (error) {
    return failConfig(path, error);
  }

  return parsed.map((item) => {
    const rule = { ...item, priority: item.priority ?? 0 } as PermissionRuleRecord;
    Object.defineProperty(rule, RULE_SOURCE, {
      value: path,
      enumerable: false,
      configurable: false,
    });
    return rule;
  });
}

export function getRuleSource(rule: PermissionRuleRecord | null | undefined): string | undefined {
  return rule?.[RULE_SOURCE];
}

export function setRuleSource(rule: PermissionRuleRecord, source: string): void {
  Object.defineProperty(rule, RULE_SOURCE, {
    value: source,
    enumerable: false,
    configurable: true,
  });
}

export interface PermissionConfigPaths {
  global: string;
  project: string;
  projectLocal: string;
  session: string | undefined;
}

export function getConfigPaths(
  cwd: string,
  sessionFile?: string,
  homeDir = homedir(),
): PermissionConfigPaths {
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

function expandToolPath(input: string): string {
  let path = input.replace(UNICODE_SPACES, " ");
  if (path.startsWith("@")) path = path.slice(1);

  if (/^file:\/\//i.test(path)) {
    try {
      return fileURLToPath(path);
    } catch {
      // Fall through and treat malformed file URLs as ordinary path strings.
    }
  }

  const home = homedir();
  if (path === "~") return home;
  if (path.startsWith("~/") || (sep === "\\" && path.startsWith("~\\"))) {
    return join(home, path.slice(2));
  }
  return path;
}

function canonicalizeIncludingMissingTail(absolutePath: string): string {
  let ancestor = absolutePath;
  const missingSegments: string[] = [];

  while (true) {
    try {
      const canonicalAncestor = realpathSync.native(ancestor);
      return resolve(canonicalAncestor, ...missingSegments.reverse());
    } catch {
      const parent = dirname(ancestor);
      if (parent === ancestor) return resolve(absolutePath);
      missingSegments.push(basename(ancestor));
      ancestor = parent;
    }
  }
}

/** Resolve paths the same way for existing and not-yet-created tool targets. */
export function normalizePath(path: string, cwd = process.cwd()): string {
  const expanded = expandToolPath(path);
  const absolutePath = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
  return canonicalizeIncludingMissingTail(absolutePath);
}

/** Replace the documented variables in a configuration regex. */
export function interpolatePattern(
  pattern: string,
  cwd = process.cwd(),
  home = homedir(),
): string {
  return pattern
    .replace(/\$\{CWD\}/g, normalizePath(cwd, cwd))
    .replace(/\$\{HOME\}/g, normalizePath(home, home));
}

export function parameterValueToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function isPathParameter(key: string, toolName?: string): boolean {
  if (toolName && BUILTIN_PATH_PARAMETERS[toolName]?.has(key)) return true;
  const compactName = key.replace(/[_-]/g, "").toLowerCase();
  return (
    PATH_PARAMETER_NAMES.has(compactName) ||
    /(?:path|paths|directory|directories|dir|dirs|cwd|workdir)$/i.test(key)
  );
}

/** Normalize path-valued tool arguments without rewriting commands or text. */
export function normalizeToolParams(
  toolName: string,
  params: Record<string, unknown>,
  cwd = process.cwd(),
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...params };

  for (const [key, value] of Object.entries(params)) {
    if (!isPathParameter(key, toolName)) continue;
    if (typeof value === "string") {
      normalized[key] = normalizePath(value, cwd);
    } else if (Array.isArray(value)) {
      normalized[key] = value.map((entry) =>
        typeof entry === "string" ? normalizePath(entry, cwd) : entry,
      );
    }
  }
  return normalized;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasUnescapedTrailingDollar(value: string): boolean {
  if (!value.endsWith("$")) return false;
  let precedingSlashes = 0;
  for (let index = value.length - 2; index >= 0 && value[index] === "\\"; index--) {
    precedingSlashes++;
  }
  return precedingSlashes % 2 === 0;
}

function hasTopLevelAlternation(pattern: string): boolean {
  let groupDepth = 0;
  let inCharacterClass = false;
  let escaped = false;

  for (const character of pattern) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "[" && !inCharacterClass) {
      inCharacterClass = true;
      continue;
    }
    if (character === "]" && inCharacterClass) {
      inCharacterClass = false;
      continue;
    }
    if (inCharacterClass) continue;
    if (character === "(") groupDepth++;
    else if (character === ")") groupDepth = Math.max(0, groupDepth - 1);
    else if (character === "|" && groupDepth === 0) return true;
  }
  return false;
}

function splitLiteralRegexPrefix(pattern: string): { literal: string; suffix: string } {
  let literal = "";
  let index = 0;

  while (index < pattern.length) {
    const character = pattern[index]!;
    if (character === "\\") {
      const next = pattern[index + 1];
      if (next !== undefined && REGEX_ESCAPABLE.has(next)) {
        literal += next;
        index += 2;
        continue;
      }
      break;
    }
    if (REGEX_META.has(character)) break;
    literal += character;
    index++;
  }

  return { literal, suffix: pattern.slice(index) };
}

/**
 * Make a path regex absolute and canonicalize its literal prefix. Regex syntax
 * after the first operator is retained, e.g. `${CWD}/src/.*\\.ts$`.
 */
export function normalizePathPattern(
  pattern: string,
  cwd = process.cwd(),
  home = homedir(),
): string {
  const canonicalCwd = normalizePath(cwd, cwd);
  const canonicalHome = normalizePath(home, home);
  const interpolated = pattern
    .replace(/\$\{CWD\}/g, escapeRegExp(canonicalCwd))
    .replace(/\$\{HOME\}/g, escapeRegExp(canonicalHome));

  const startAnchor = interpolated.startsWith("^") ? "^" : "";
  let body = startAnchor ? interpolated.slice(1) : interpolated;
  const endAnchor = hasUnescapedTrailingDollar(body) ? "$" : "";
  if (endAnchor) body = body.slice(0, -1);

  // A regex-only pattern (for example `.*`) has no literal path prefix to
  // resolve. Preserve it as an expression instead of narrowing it to CWD.
  if (hasTopLevelAlternation(body)) return `${startAnchor}${body}${endAnchor}`;

  const { literal, suffix } = splitLiteralRegexPrefix(body);
  if (literal.length === 0) return `${startAnchor}${body}${endAnchor}`;
  const prefixHadSeparator = literal.endsWith(sep) || literal.endsWith("/");
  let absolutePrefix: string;
  if (literal.length === 0) {
    absolutePrefix = canonicalCwd === sep ? canonicalCwd : `${canonicalCwd}${sep}`;
  } else {
    absolutePrefix = normalizePath(literal, cwd);
    if (prefixHadSeparator && absolutePrefix !== sep && !absolutePrefix.endsWith(sep)) {
      absolutePrefix += sep;
    }
  }

  return `${startAnchor}${escapeRegExp(absolutePrefix)}${suffix}${endAnchor}`;
}

export function matchRule(
  rule: PermissionRuleRecord | Record<string, unknown>,
  toolName: string,
  params: Record<string, unknown>,
  cwd = process.cwd(),
): boolean {
  if (rule.tool !== toolName) return false;

  const parameters = rule.parameters;
  if (parameters === undefined) return true;
  if (!isRecord(parameters)) return false;

  for (const [key, patternValue] of Object.entries(parameters)) {
    if (!Object.hasOwn(params, key) || typeof patternValue !== "string") return false;

    const inputValue = params[key];
    const candidate =
      isPathParameter(key, toolName) && typeof inputValue === "string"
        ? normalizePath(inputValue, cwd)
        : parameterValueToString(inputValue);
    const regexSource = isPathParameter(key, toolName)
      ? normalizePathPattern(patternValue, cwd)
      : interpolatePattern(patternValue, cwd);

    try {
      if (!new RegExp(regexSource).test(candidate)) return false;
    } catch {
      // An invalid pattern never grants permission.
      return false;
    }
  }

  return true;
}

/** Resolve highest priority first; ties are won by the last (most local) rule. */
export function resolveRules(
  rulesList: PermissionRuleRecord[][],
  toolName: string,
  params: Record<string, unknown>,
  cwd = process.cwd(),
): PermissionRuleRecord {
  const matches = rulesList.flat().filter((rule) => matchRule(rule, toolName, params, cwd));
  if (matches.length === 0) {
    return { tool: toolName, policy: "ask", priority: 0, virtual: true };
  }

  let winner = matches[0]!;
  for (const candidate of matches.slice(1)) {
    const candidatePriority = candidate.priority ?? 0;
    const winnerPriority = winner.priority ?? 0;
    if (candidatePriority >= winnerPriority) winner = candidate;
  }
  return winner;
}
