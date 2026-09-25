import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
function expandToolPath(input) {
    let path = input.replace(UNICODE_SPACES, " ");
    if (path.startsWith("@"))
        path = path.slice(1);
    if (/^file:\/\//i.test(path)) {
        try {
            return fileURLToPath(path);
        }
        catch {
            // fall through
        }
    }
    const home = homedir();
    if (path === "~")
        return home;
    if (path.startsWith("~/") || (sep === "\\" && path.startsWith("~\\"))) {
        return join(home, path.slice(2));
    }
    return path;
}
function canonicalizeIncludingMissingTail(absolutePath) {
    let ancestor = absolutePath;
    const missingSegments = [];
    while (true) {
        try {
            const canonicalAncestor = realpathSync.native(ancestor);
            return resolve(canonicalAncestor, ...missingSegments.reverse());
        }
        catch {
            const parent = dirname(ancestor);
            if (parent === ancestor)
                return resolve(absolutePath);
            missingSegments.push(basename(ancestor));
            ancestor = parent;
        }
    }
}
export function normalizePath(path, cwd = process.cwd()) {
    const expanded = expandToolPath(path);
    const absolutePath = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
    return canonicalizeIncludingMissingTail(absolutePath);
}
export function interpolatePattern(pattern, cwd = process.cwd(), home = homedir()) {
    return pattern
        .replace(/\$\{CWD\}/g, normalizePath(cwd, cwd))
        .replace(/\$\{HOME\}/g, normalizePath(home, home));
}
