import { registerPromptRenderer } from "../prompt-registry.js"

// Default renderers for common tools
registerPromptRenderer("edit", (_event, params) => {
  const path = typeof params.path === "string" ? params.path : "<unknown>"
  const edits = Array.isArray(params.edits) ? params.edits : []
  const bodyLines = [`File: ${path}`, "---"]
  for (const edit of edits) {
    const oldText = typeof (edit as Record<string, unknown>).oldText === "string" ? (edit as Record<string, unknown>).oldText as string : ""
    const newText = typeof (edit as Record<string, unknown>).newText === "string" ? (edit as Record<string, unknown>).newText as string : ""
    const lines = oldText.split("\n")
    for (const line of lines) {
      bodyLines.push("- " + line)
    }
    const newLines = newText.split("\n")
    for (const line of newLines) {
      bodyLines.push("+ " + line)
    }
  }
  return {
    kind: "default",
    title: `Edit required for ${path}`,
    body: bodyLines.join("\n"),
  }
})


registerPromptRenderer("read", (_event, params) => {
  const filePath = typeof params.path === "string" ? params.path : "<unknown>"
  const offset = typeof params.offset === "number" ? params.offset : undefined
  const limit = typeof params.limit === "number" ? params.limit : undefined
  const previewLines = [`File: ${filePath}`]
  if (offset !== undefined) previewLines.push(`Offset: ${offset}`)
  if (limit !== undefined) previewLines.push(`Limit: ${limit} lines`)
  return {
    kind: "default",
    title: `Read: ${filePath}`,
    body: previewLines.join("\n"),
  }
})
