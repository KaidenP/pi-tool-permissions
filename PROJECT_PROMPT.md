# Project: Pi Tool Permissions Extension - Implementation Plan

## Overview
Create a pi extension that manages toolcall permissions. The goal is to provide a security layer where the agent must request user permission before executing certain tools or accessing specific files/paths, while allowing for granular overrides via configuration.

---

## Quick Links
- [Phase 1: Project Setup & Foundation](PROJECT_PROMPT_PHASE_01.md)
- [Phase 2: Configuration Engine](PROJECT_PROMPT_PHASE_02.md)
- [Phase 3: Permission Logic & Interception](PROJECT_PROMPT_PHASE_03.md)
- [Phase 4: TUI Interaction & Persistence](PROJECT_PROMPT_PHASE_04.md)
- [Phase 5: Testing & Refinement](PROJECT_PROMPT_PHASE_05.md)

---

## Phase 1: Project Setup & Foundation
Reference: [Pi Extensions Documentation](docs/extensions.md#writing-an-extension) (Lines 100-200)

- [ ] **Initialize Project**: Create the directory structure and `package.json` with necessary dependencies (`typebox`, `js-yaml`).
- [ ] **Extension Skeleton**: Create the entry point (e.g., `src/index.ts`) using the Pi `ExtensionAPI`.
- [ ] **Configuration Schema**: Define TypeBox schemas for the YAML configuration files to ensure valid input.
- [ ] **Basic Logging**: Implement a logging utility to track permission checks and blocks during development.

## Phase 2: Configuration Engine
Note: `CONFIG_DIR_NAME` is the pi extension constant.

- [ ] **YAML Loader**: Implement logic to load `~/CONFIG_DIR_NAME/permissions.yaml` (Global), `CONFIG_DIR_NAME/permissions.yaml` (Project), and `CONFIG_DIR_NAME/permissions.local.yaml` (Project Local).
- [ ] **Regex Parser**: Build a parser that handles the following configuration syntax, supporting regex for parameter values:
```yaml
- tool: "<tool_name>"
  parameters:
    "<param_name>": "<regex>"
  permission: "<allow|deny|ask>"
```
If a parameter is omitted from the `parameters` block, it assumes any value is acceptable.

- [ ] **Priority Resolver**: Implement the logic to resolve permissions by concatenating configuration rules from all sources into a single array in the following order (last match wins):
    1. Global config (`~/CONFIG_DIR_NAME/permissions.yaml`)
    2. Project config (`CONFIG_DIR_NAME/permissions.yaml`)
    3. Project local config (`CONFIG_DIR_NAME/permissions.local.yaml`)
    4. Session-specific overrides (from `<uuid>.permissions.yaml` in the session directory)

Rules are evaluated top-to-bottom; the last matching entry in the concatenated array wins. This allows for catch-all rules followed by more specific overrides across different scopes.

## Phase 3: Permission Logic & Interception
- [ ] **Event Subscription**: Subscribe to the `tool_call` event using `pi.on("tool_call", ...)`.
- [ ] **Interception Middleware**: Implement logic to:
    - Identify the tool and its arguments.
    - Query the Configuration Engine for the required action (`allow`, `deny`, `ask`).
    - Block execution if `deny` is returned.
    - Trigger TUI prompt if `ask` is returned.
- [ ] **Default Behavior**: If a tool is not defined in any configuration, it should default to `ask`.

## Phase 4: TUI Interaction & Persistence
- [ ] **User Prompt UI**: Implement the TUI interaction using `ctx.ui.confirm` and `ctx.ui.select`.
    - Show tool name and arguments clearly.
    - Provide five options for the user:
        1. "Allow once": Proceed with this specific call only (return `{ block: false }`). No persistent changes.
        2. "Allow only this session": Grant permission for this tool/pattern only for the current session. Update `<uuid>.permissions.yaml` in the session directory.
        3. "Allow always (Project-local)": Grant permission for this tool/pattern only within the current project scope, persisted in `CONFIG_DIR_NAME/permissions.local.yaml`.
        4. "Allow always (Project)": Grant permission for this tool/pattern across all projects in this directory, persisted in `CONFIG_DIR_NAME/permissions.yaml`.
        5. "Allow always (Global)": Grant permission for this tool/pattern globally, persisted in `~/CONFIG_DIR_NAME/agent/permissions.yaml`.
- [ ] **State Management**: 
    - Create a persistence layer for session-specific permissions in the session directory (`~/CONFIG_DIR_NAME/agent/sessions/<dir>/<uuid>.permissions.yaml`).
    - Implement logic to update this file when "Always" permissions are granted.
- [ ] **Session Integration**: Optionally use `pi.appendEntry()` to store session-specific permission overrides if needed, though persistent files are preferred for global/project rules.

## Phase 5: Testing & Refinement
- [ ] **Unit Tests**: Test the regex parser and priority resolver with various YAML inputs.
- [ ] **Integration Tests**: Verify that built-in tools (`read`, `bash`, `edit`) are correctly blocked/allowed based on config.
- **Edge Case Handling**: 
    - Handle cases where a tool is not defined in any config (default to `ask`).
    - Ensure the extension doesn't block its own required operations or critical system paths.
- [ ] **Documentation & Examples**: Provide example YAML configurations and instructions for users.

---

## Technical Specifications
- **Language**: TypeScript / Node.js (Pi uses `jiti` for loading extensions).
- **Schema Validation**: Use `typebox` to define tool parameters and configuration schemas.
- **Regex Support**: The configuration parser must support regex for the `args` part of the pattern matching.
- **Priority**:
    Rules are concatenated and evaluated top-to-bottom, where the last match wins. The order of concatenation (from lowest to highest priority) is:
    1. Global config (`~/CONFIG_DIR_NAME/permissions.yaml`)
    2. Project config (`CONFIG_DIR_NAME/permissions.yaml`)
    3. Project local config (`CONFIG_DIR_NAME/permissions.local.yaml`)
    4. Session-specific overrides (from `<uuid>.permissions.yaml` in the session directory)
- **Extension API**: Use the `ExtensionAPI` provided by `@earendil-works/pi-coding-agent`.

## Success Criteria
- The agent cannot execute a tool without permission unless it is explicitly allowed by the YAML or previous user consent.
- The TUI correctly captures and persists "Always" permissions.
- The configuration parser correctly handles regex patterns for arguments.
