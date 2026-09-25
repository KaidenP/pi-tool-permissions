import { registerPromptRenderer } from "../prompt-registry.js"

// Custom renderer for bash: shows the command being executed.
registerPromptRenderer("bash", (_event, params) => {
  const command = typeof params.command === "string" ? params.command : "<unknown>"
  return `Bash: \`${command}\``
})
