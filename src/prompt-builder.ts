import type { ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import type { PermissionRuleRecord } from "./types.js";

export const PROMPT_CHOICES = [
  "Deny",
  "Allow once",
  "Allow only in this session",
  "Allow always (Project-local)",
  "Allow always (Project)",
  "Allow always (Global)",
] as const;

export type ChoiceKey = (typeof PROMPT_CHOICES)[number];

type ChoiceResult =
  | { action: "deny"; scope?: never }
  | { action: "allow-once"; scope?: never }
  | { action: "persist"; scope: "session" | "projectLocal" | "project" | "global" };

export function resolveChoice(choice: ChoiceKey): ChoiceResult {
  switch (choice) {
    case "Deny": return { action: "deny" };
    case "Allow once": return { action: "allow-once" };
    case "Allow only in this session": return { action: "persist", scope: "session" };
    case "Allow always (Project-local)": return { action: "persist", scope: "projectLocal" };
    case "Allow always (Project)": return { action: "persist", scope: "project" };
    case "Allow always (Global)": return { action: "persist", scope: "global" };
  }
  return { action: "deny", scope: undefined as never } as ChoiceResult;
}

export function makePromptTitle(toolName: string, parameters: Record<string, unknown>): string {
  const args = JSON.stringify(parameters, null, 2) ?? "{}";
  return `Permission required for ${toolName}\n\nArguments:\n${args}`;
}

export function priorityForNewAllowRule(winningRule: PermissionRuleRecord): number {
  const current = Math.max(0, Math.floor(winningRule.priority ?? 0));
  return current + 1;
}

export function denied(reason: string): ToolCallEventResult {
  return { block: true, reason, terminate: true };
}
