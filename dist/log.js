"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDecision = logDecision;
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const node_fs_1 = require("node:fs");
const pi_coding_agent_1 = require("@earendil-works/pi-coding-agent");
const logDir = (0, node_path_1.join)((0, node_os_1.homedir)(), pi_coding_agent_1.CONFIG_DIR_NAME, "agent", "logs");
const logPath = (0, node_path_1.join)(logDir, "permissions.log");
function ensureDir() {
    if (!(0, node_fs_1.existsSync)(logDir))
        (0, node_fs_1.mkdirSync)(logDir, { recursive: true });
}
function trimLog() {
    if (!(0, node_fs_1.existsSync)(logPath))
        return;
    const content = (0, node_fs_1.readFileSync)(logPath, "utf8");
    const lines = content.split("\n");
    if (lines.length > 500) {
        const trimmed = lines.slice(lines.length - 500).join("\n");
        (0, node_fs_1.writeFileSync)(logPath, trimmed + (trimmed ? "\n" : ""));
    }
}
function logDecision(tool, action, source) {
    ensureDir();
    const entry = `${new Date().toISOString()} | ${tool} | ${action} | ${source}`;
    (0, node_fs_1.writeFileSync)(logPath, ((0, node_fs_1.existsSync)(logPath) ? (0, node_fs_1.readFileSync)(logPath, "utf8") + "\n" : "") + entry);
    trimLog();
}
