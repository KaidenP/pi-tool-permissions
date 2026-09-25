import { normalizePath } from "./path-utils.js";

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

const BUILTIN_PATH_PARAMETERS: Record<string, ReadonlySet<string>> = {
  read: new Set(["path"]),
  edit: new Set(["path"]),
  write: new Set(["path"]),
  grep: new Set(["path"]),
  find: new Set(["path"]),
  ls: new Set(["path"]),
};

const PATH_PARAMETER_NAMES = new Set([
  "path", "paths", "file", "files", "filepath", "filepaths",
  "directory", "directories", "dir", "dirs", "cwd", "workdir", "workingdirectory",
]);

export function isPathParameter(key: string, toolName?: string): boolean {
  if (toolName && BUILTIN_PATH_PARAMETERS[toolName]?.has(key)) return true;
  const compactName = key.replace(/[_-]/g, "").toLowerCase();
  return (
    PATH_PARAMETER_NAMES.has(compactName) ||
    /(?:path|paths|directory|directories|dir|dirs|cwd|workdir)$/i.test(key)
  );
}

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
