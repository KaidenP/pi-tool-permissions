import { modeState } from "./mode-manager.js";

export function renderWidgetLines(): string[] {
  if (modeState.mode !== "permission-bypass") return [];
  return ["\x1b[31m[BYPASS MODE] — Permissions disabled\x1b[0m"];
}

export function statusText(): string {
  return modeState.mode === "permission-bypass" ? "\x1b[31mBYPASS\x1b[0m" : "DEFAULT";
}

export function isBypass(): boolean {
  return modeState.mode === "permission-bypass";
}
