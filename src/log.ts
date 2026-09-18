import { join } from "node:path";
import { homedir } from "node:os";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";

const logPath = join(homedir(), CONFIG_DIR_NAME, "agent", "logs", "permissions.log");
export function logDecision(tool: string, action: string, source: string) {
  // trimmed to 500 lines
  console.log(`[PERM] ${new Date().toISOString()} | ${tool} | ${action} | ${source}`);
}
