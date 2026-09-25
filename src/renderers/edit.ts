import { registerPromptRenderer } from "../prompt-registry.js"

registerPromptRenderer("edit", (_event, params) => {
  const path = typeof params.path === "string" ? params.path : "<unknown>"
  const edits = Array.isArray(params.edits) ? params.edits : []
  const bodyLines = [`File: ${path}`, "---"]
  for (const edit of edits) {
    const oldText = typeof (edit as Record<string, unknown>).oldText === "string" ? (edit as Record<string, unknown>).oldText as string : ""
    const newText = typeof (edit as Record<string, unknown>).newText === "string" ? (edit as Record<string, unknown>).newText as string : ""
    const lines = oldText.split("\n")
    for (const line of lines) bodyLines.push("- " + line)
    const newLines = newText.split("\n")
    for (const line of newLines) bodyLines.push("+ " + line)
  }
  return { kind: "default", title: `Edit required for ${path}`, body: bodyLines.join("\n") }
})
