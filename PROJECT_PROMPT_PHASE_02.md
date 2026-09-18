# Phase 2: Interception & User Interaction

## Overview
Implement the core logic for intercepting tool calls and the TUI interaction layer for requesting user permissions.

## Technical Requirements
- **Event**: Use `pi.on("tool_call", ...)` to intercept calls.
- **Blocking**: Return `{ block: true, reason: "...", terminate: true }` to stop execution and terminate the turn. `terminate` only applies to a blocked call; the agent stops early only when every finalized result in the batch is terminating.
- **UI Guard**: Use `ctx.hasUI` before presenting UI prompts. In non-TUI modes, default to a safe behavior (e.g., deny or log and continue).

## Tasks
- [ ] **Interception Middleware**:
    - Subscribe to `tool_call` in the entry point.
    - Query the Configuration Engine (Phase 1) to find the matching rule.
    - **Default Behavior**: If no matching rule is found, default to a virtual `ask` policy with priority 0.
    - Pass the winning rule's `policy` key, `priority`, and event context to the `PolicyRegistry`.
    - Use the `PolicyDecision` returned by the registry to determine the outcome:
      - If `decision` is `deny`: Block execution immediately and terminate the turn (`terminate: true`).
      - If `decision` is `allow`: Allow execution to proceed.
      - If `decision` is `ask`: Trigger the User Prompt UI.
- [ ] **User Prompt UI**:
    - Implement a TUI prompt using `ctx.ui` that displays the tool name and its arguments.
    - Use `ctx.hasUI` to guard all UI calls (confirm, select, input, notify). In non-TUI modes, log the decision and continue with a safe default.
    - Provide the following choice options:
        1. **"Allow once"**: Return `{ block: false }`. No persistence.
        2. **"Allow only in this session"**: Persist rule to the session-specific `.permissions.yaml` file. If the session is ephemeral, store in memory only.
        3. **"Allow always (Project-local)"**: Persist rule to `ctx.cwd/CONFIG_DIR_NAME/permissions.local.yaml`.
        4. **"Allow always (Project)"**: Persist rule to `ctx.cwd/CONFIG_DIR_NAME/permissions.yaml`.
        5. **"Allow always (Global)"**: Persist rule to `~/CONFIG_DIR_NAME/agent/permissions.yaml`.
- [ ] **Persistence Implementation**:
    - Implement the logic to write new rules to the corresponding YAML files based on the user's choice.
    - Ensure that new rules are appended to the end of the file to maintain the "last match wins" priority.
    - Use `isToolCallEventType` (imported from `@earendil-works/pi-coding-agent`) for type-safe access to tool parameters.
- [ ] **Session Integration**: 
    - Ensure the session-specific path is derived correctly from `ctx.sessionManager.getSessionFile()` by replacing `.jsonl` with `.permissions.yaml`.

## Success Criteria
- Tools are correctly blocked/allowed based on config.
- Undefined tools correctly trigger the "ask" prompt.
- TUI prompts appear and correctly capture the desired persistence scope.
- "Always" decisions are persisted to the correct files and respected immediately in the next call.
