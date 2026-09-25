import { registerPromptRenderer } from "../prompt-registry.js"

registerPromptRenderer("bash", (_event, params) => {
  const command = typeof params.command === "string" ? params.command : "<unknown>"
  return `Bash: ${command}`
})
