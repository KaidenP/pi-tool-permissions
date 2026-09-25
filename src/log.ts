import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";

const logDir = join(homedir(), CONFIG_DIR_NAME, "agent", "logs");
const logPath = join(logDir, "permissions.log");
const MAX_LOG_LINES = 500;

function ensureDir(): void {
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]/g, "\\n").replaceAll("|", "\\|");
}

export function trimLogFile(path: string, maxLines = MAX_LOG_LINES): void {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length > maxLines) {
    writeFileSync(path, `${lines.slice(Math.max(0, lines.length - maxLines)).join("\n")}\n`, "utf8");
  }
}

/** Record a permission decision and retain only the latest 500 entries. */
export function logDecision(tool: string, action: string, source: string): void {
  ensureDir();
  const entry = [new Date().toISOString(), tool, action, source].map(singleLine).join(" | ");
  appendFileSync(logPath, `${entry}\n`, "utf8");
  trimLogFile(logPath);
}
