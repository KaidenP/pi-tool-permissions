import { registerPromptRenderer } from "../prompt-registry.js";
registerPromptRenderer("write", (_event, params) => {
    const path = typeof params.path === "string" ? params.path : "<unknown>";
    return `Write: ${path}`;
});
