# Phase 2: Interception & User Interaction

## Overview
Implement the core logic for intercepting tool calls and the TUI interaction layer for requesting user permissions.

## Technical Requirements
- **Event**: Use `pi.on("tool_call", ...)` to intercept calls.
- **Blocking**: Return `{ block: true, reason: "..." }` to stop execution.
- **UI**: Use `ctx.ui.confirm` and `ctx.ui.select` for interaction.

## Tasks
- [ ] **Interception Middleware**:
    - Subscribe to `tool_call` in the entry point.
    - Query the Configuration Engine (Phase 1) for the action (`allow`, `deny`, `ask`).
    - **Default Behavior**: If no matching rule is found across any config file, default to `ask`.
    - If `deny`: Block execution immediately.
    - If `allow`: Allow execution to proceed.
    - If `ask`: Trigger the User Prompt UI.
- [ ] **User Prompt UI**:
    - Implement a TUI prompt using `ctx.ui` that displays the tool name and its arguments.
    - Provide the following choice options:
        1. **"Allow once"**: Return `{ block: false }`. No persistence.
        2. **"Allow only in this session"**: Persist rule to the session-specific `.permissions.yaml` file.
        3. **"Allow always (Project-local)"**: Persist rule to `CONFIG_DIR_NAME/permissions.local.yaml`.
        4. **"Allow always (Project)"**: Persist rule to `CONFIG_DIR_NAME/permissions.yaml`.
        5. **"Allow always (Global)"**: Persist rule to `~/CONFIG_DIR_NAME/agent/permissions.yaml`.
- [ ] **Persistence Implementation**:
    - Implement the logic to write new rules to the corresponding YAML files based on the user's choice.
    - Ensure that new rules are appended to the end of the file to maintain the "last match wins" priority.
- [ ] **Session Integration**: 
    - Ensure the session-specific path is derived correctly from `ctx.sessionManager.getSessionFile()` by replacing `.jsonl` with `.permissions.yaml`.

## Success Criteria
- Tools are correctly blocked/allowed based on config.
- Undefined tools correctly trigger the "ask" prompt.
- TUI prompts appear and correctly capture the desired persistence scope.
- "Always" decisions are persisted to the correct files and respected immediately in the next call.
