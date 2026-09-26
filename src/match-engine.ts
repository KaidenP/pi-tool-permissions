import { interpolatePattern, normalizePath } from "./path-utils.js";
import { homedir } from "node:os";
import { parameterValueToString, isPathParameter, normalizeToolParams } from "./parameter-normalizer.js";
import { type PermissionRuleRecord } from "./types.js";

const REGEX_META = new Set([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]"]);
const REGEX_ESCAPABLE = new Set(["\\", ...REGEX_META, "/"]);

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

export function normalizePathPattern(
  pattern: string,
  cwd = process.cwd(),
  homeDir = homedir(),
): string {
  const canonicalCwd = normalizePath(cwd, cwd);
  const canonicalHome = normalizePath(homeDir, homeDir);
  const interpolated = pattern
    .replace(/\$\{CWD\}/g, escapeRegExp(canonicalCwd))
    .replace(/\$\{HOME\}/g, escapeRegExp(canonicalHome));
  const startAnchor = interpolated.startsWith("^") ? "^" : "";
  let body = startAnchor ? interpolated.slice(1) : interpolated;
  const endAnchor = hasUnescapedTrailingDollar(body) ? "$" : "";
  if (endAnchor) body = body.slice(0, -1);
  if (hasTopLevelAlternation(body)) return `${startAnchor}${body}${endAnchor}`;
  const { literal, suffix } = splitLiteralRegexPrefix(body);
  if (literal.length === 0) return `${startAnchor}${body}${endAnchor}`;
  const prefixHadSeparator = literal.endsWith("/") || literal.endsWith("\\");
  let absolutePrefix: string;
  if (literal.length === 0) {
    absolutePrefix = canonicalCwd === "/" ? canonicalCwd : `${canonicalCwd}/`;
  } else {
    absolutePrefix = normalizePath(literal, cwd);
    if (prefixHadSeparator && absolutePrefix !== "/" && !absolutePrefix.endsWith("/") && !absolutePrefix.endsWith("\\")) {
      absolutePrefix += "/";
    }
  }
  return `${startAnchor}${escapeRegExp(absolutePrefix)}${suffix}${endAnchor}`;
}

/**
 * Matches a specific tool call against a permission rule.
 * 
 * The matching process:
 * 1. Checks if the tool name matches.
 * 2. If the rule has no parameters, it's a broad match for the tool.
 * 3. If a parameter is defined in the rule, the corresponding parameter in the tool call
 *    must exist and match the regex pattern defined in the rule.
 * 4. Path-related parameters are normalized to absolute paths before matching.
 * 5. Non-path parameters are converted to strings.
 */
export function matchRule(
  rule: PermissionRuleRecord | Record<string, unknown>,
  toolName: string,
  params: Record<string, unknown>,
  cwd = process.cwd(),
): boolean {

  if (rule.tool !== toolName) return false;
  const parameters = rule.parameters;
  if (parameters === undefined) return true;
  if (typeof parameters !== "object" || parameters === null || Array.isArray(parameters)) return false;
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
      return false;
    }
  }
  return true;
}

/**
 * Resolves the winning permission rule for a given tool call from a list of scopes.
 * 
 * Scopes are ordered by priority (global -> project -> project-local -> session).
 * Within a scope, rules that match are filtered.
 * From all matching rules across all scopes, the one with the highest priority wins.
 * If no rules match, a virtual "ask" rule is returned.
 */
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
