import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { PolicyRegistry } from "./policy-registry";

const registry = new PolicyRegistry();

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    // Phase 2: Interception middleware stub
    if (!ctx.hasUI) {
      // Non-TUI safe default: deny
      return { block: true, reason: "No UI available - default deny", terminate: true };
    }
    // Allow by default in Phase 2 stub (full logic in Phase 3)
    const ok = await ctx.ui.confirm("Permission", `Allow tool: ${event.toolName}?`);
    if (!ok) return { block: true, reason: "Denied by user", terminate: true };
  });
}
// Persistence stub for Phase 2
function persistRule(scope: string, rule: any) {
  console.log(`[PERSIST] ${scope}`, rule);
}
