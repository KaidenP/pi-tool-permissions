# Phase 3: Permission Logic & Interception

## Overview
Implement the core logic for intercepting tool calls and blocking/prompting based on configuration rules. Reference: [Pi Tool Events](docs/extensions.md#tool-events) (Lines 350-600).

## Tasks
...
- [ ] **Event Subscription**: Subscribe to the `tool_call` event using `pi.on("tool_call", ...)` in the extension entry point.
- [ ] **Interception Middleware**: Implement the logic within the `tool_call` handler:
    - Identify the tool name and its arguments from the event.
    - Query the Configuration Engine (from Phase 2) for the required action (`allow`, `deny`, `ask`).
    - If `deny`: Block execution by returning `{ block: true, reason: "Blocked by configuration" }`.
    - If `ask`: Trigger the TUI prompt (to be implemented in Phase 4).
    - If `allow`: Allow the tool call to proceed.
- [ ] **Default Rules Implementation**: Hardcode a set of default security rules as a fallback when no config is found:
    - All tools default to `ask`

- [ ] **Git Commit**: Make at least one commit after completing the tasks in this phase.

## Success Criteria
- The extension correctly intercepts all tool calls.
- Tools are blocked/allowed according to the configuration engine's output.
- Default security rules are applied correctly when no config is present.
