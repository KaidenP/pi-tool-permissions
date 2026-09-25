import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
const logDir = join(homedir(), CONFIG_DIR_NAME, "agent", "logs");
const logPath = join(logDir, "permissions.log");
function ensureDir() {
    if (!existsSync(logDir))
        mkdirSync(logDir, { recursive: true });
}
function trimLog() {
    if (!existsSync(logPath))
        return;
    const content = readFileSync(logPath, "utf8");
    const lines = content.split("\n");
    if (lines.length > 500) {
        const trimmed = lines.slice(lines.length - 500).join("\n");
        writeFileSync(logPath, trimmed + (trimmed ? "\n" : ""));
    }
}
export function logDecision(tool, action, source) {
    ensureDir();
    const entry = `${new Date().toISOString()} | ${tool} | ${action} | ${source}`;
    writeFileSync(logPath, (existsSync(logPath) ? readFileSync(logPath, "utf8") + "\n" : "") + entry);
    trimLog();
}
