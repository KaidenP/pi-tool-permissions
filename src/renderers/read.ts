import { registerPromptRenderer } from "../prompt-registry.js"

registerPromptRenderer("read", (_event, params) => {
  const filePath = typeof params.path === "string" ? params.path : "<unknown>"
  const offset = typeof params.offset === "number" ? params.offset : undefined
  const limit = typeof params.limit === "number" ? params.limit : undefined
  const previewLines = [`File: ${filePath}`]
  if (offset !== undefined) previewLines.push(`Offset: ${offset}`)
  if (limit !== undefined) previewLines.push(`Limit: ${limit} lines`)
  return { kind: "default", title: `Read: ${filePath}`, body: previewLines.join("\n") }
})
