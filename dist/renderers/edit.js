import { registerPromptRenderer } from "../prompt-registry.js";
registerPromptRenderer("edit", (_event, params) => {
    const path = typeof params.path === "string" ? params.path : "<unknown>";
    return `Edit: ${path}`;
});
