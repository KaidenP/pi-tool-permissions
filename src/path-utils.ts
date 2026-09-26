import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;

function expandToolPath(input: string): string {
  let path = input.replace(UNICODE_SPACES, " ");
  if (path.startsWith("@")) path = path.slice(1);
  if (/^file:\/\//i.test(path)) {
    try {
      return fileURLToPath(path);
    } catch {
      // fall through
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

/**
 * Normalized paths are used for both rule matching and persistence to ensure consistency
 * regardless of how a path is referenced (e.g., absolute vs relative, symlinks).
 */
export function normalizePath(path: string, cwd = process.cwd()): string {
  const expanded = expandToolPath(path);
  const absolutePath = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
  return canonicalizeIncludingMissingTail(absolutePath);
}


export function interpolatePattern(
  pattern: string,
  cwd = process.cwd(),
  home = homedir(),
): string {
  return pattern
    .replace(/\$\{CWD\}/g, normalizePath(cwd, cwd))
    .replace(/\$\{HOME\}/g, normalizePath(home, home));
}
