import { registerPromptRenderer } from "../prompt-registry.js";
import { readFile } from "node:fs/promises";
async function countLines(filePath) {
    try {
        const data = await readFile(filePath, "utf8");
        return data.split(/\r?\n/).length;
    }
    catch {
        return undefined;
    }
}
registerPromptRenderer("read", async (_event, params) => {
    const filePath = typeof params.path === "string" ? params.path : "<unknown>";
    const offset = typeof params.offset === "number" ? params.offset : undefined;
    const limit = typeof params.limit === "number" ? params.limit : undefined;
    const totalLines = filePath !== "<unknown>" ? await countLines(filePath) : undefined;
    const startStr = offset !== undefined ? `L${String(offset + 1).padStart(3, "0")}` : "L001";
    let endVal = undefined;
    if (offset !== undefined && limit !== undefined)
        endVal = offset + limit;
    else if (limit !== undefined)
        endVal = limit;
    const endStr = endVal !== undefined ? `L${String(endVal).padStart(3, "0")}` : (totalLines !== undefined ? `L${String(totalLines).padStart(3, "0")}` : "L999");
    let countStr = "? lines";
    if (totalLines !== undefined)
        countStr = `${totalLines} lines`;
    else if (limit !== undefined)
        countStr = `${limit} lines`;
    return `Read: ${filePath}\n${startStr}-${endStr} (${countStr})`;
});
