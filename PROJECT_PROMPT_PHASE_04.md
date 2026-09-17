# Phase 4: TUI Interaction & Persistence

Note: `CONFIG_DIR_NAME` is the pi extension constant.

## Overview
Implement the user interface for permission prompts and the persistence layer for "Always" permissions. Reference: [Pi UI & Session Management](docs/extensions.md#custom-ui) (Lines 1400-2350).

## Tasks
...
- [ ] **User Prompt UI**: Implement the TUI interaction using Pi's built-in `ctx.ui` methods:
    - Use `ctx.ui.confirm` to display a prompt showing the tool name and its arguments.
    - Provide five options for the user:
        1. "Allow once": Proceed with this specific call only (return `{ block: false }`). No persistent changes.
        2. "Allow only in this session": Grant permission for this tool/pattern only for the current session. Update `<uuid>.permissions.yaml` in the session directory.
        3. "Allow always (Project-local)": Grant permission for this tool/pattern only within the current project scope, persisted in `CONFIG_DIR_NAME/permissions.local.yaml`.
        4. "Allow always (Project)": Grant permission for this tool/pattern across all projects in this directory, persisted in `CONFIG_DIR_NAME/permissions.yaml`.
        5. "Allow always (Global)": Grant permission for this tool/pattern globally, persisted in `~/CONFIG_DIR_NAME/permissions.yaml`.
- [ ] **State Management**: 
    - Create a persistence layer for session-specific permissions in the session directory (`~/CONFIG_DIR_NAME/agent/sessions/<dir>/<uuid>.permissions.yaml`).
    - Implement logic to update this file when a user selects the "Allow only in this session" option.
- [ ] **Session Integration**: Optionally use `pi.appendEntry()` to store session-specific permission overrides if needed, though persistent files are preferred for global/project rules.
- [ ] **Git Commit**: Make at least one commit after completing the tasks in this phase.

## Success Criteria
- Users can be prompted via a clear TUI when an "ask" action is triggered.
- "Always" permissions are correctly persisted and respected in subsequent tool calls.
- The UI correctly distinguishes between Global and Project scopes for "Always" permissions.
