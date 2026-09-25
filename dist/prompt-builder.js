export const PROMPT_CHOICES = [
    "Deny",
    "Allow once",
    "Allow only in this session",
    "Allow always (Project-local)",
    "Allow always (Project)",
    "Allow always (Global)",
];
export function resolveChoice(choice) {
    switch (choice) {
        case "Deny": return { action: "deny" };
        case "Allow once": return { action: "allow-once" };
        case "Allow only in this session": return { action: "persist", scope: "session" };
        case "Allow always (Project-local)": return { action: "persist", scope: "projectLocal" };
        case "Allow always (Project)": return { action: "persist", scope: "project" };
        case "Allow always (Global)": return { action: "persist", scope: "global" };
    }
    return { action: "deny", scope: undefined };
}
export function makePromptTitle(toolName, parameters) {
    const args = JSON.stringify(parameters, null, 2) ?? "{}";
    return `Permission required for ${toolName}\n\nArguments:\n${args}`;
}
export function priorityForNewAllowRule(winningRule) {
    const current = Math.max(0, Math.floor(winningRule.priority ?? 0));
    return current + 1;
}
export function denied(reason) {
    return { block: true, reason, terminate: true };
}
