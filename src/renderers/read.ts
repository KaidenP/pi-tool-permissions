import { registerPromptRenderer } from "../prompt-registry.js"

registerPromptRenderer("read", (_event, params) => {
  const filePath = typeof params.path === "string" ? params.path : "<unknown>"
  const offset = typeof params.offset === "number" ? params.offset : undefined
  const limit = typeof params.limit === "number" ? params.limit : undefined

  const startStr = offset !== undefined ? `L${String(offset + 1).padStart(4, "0")}` : "<"
  const endVal = offset !== undefined && limit !== undefined ? offset + limit : (limit !== undefined ? limit : undefined)
  const endStr = endVal !== undefined ? `L${String(endVal).padStart(4, "0")}` : ">"
  const countStr = limit !== undefined ? `${limit} lines` : "? lines"

  return {
    kind: "default",
    title: `Read: ${filePath}`,
    body: `${startStr}-${endStr} (${countStr})`,
  }
})
