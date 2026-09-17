# Phase 2: Configuration Engine

Note: `CONFIG_DIR_NAME` is the pi extension constant.

## Overview
Implement the logic to load, parse, and resolve permissions from YAML configuration files.

## Tasks
- [ ] **YAML Loader**: Implement a utility to load `~/CONFIG_DIR_NAME/permissions.yaml` (Global), `CONFIG_DIR_NAME/permissions.yaml` (Project), and `CONFIG_DIR_NAME/permissions.local.yaml` (Project Local). Ensure project-scoped config takes precedence over Global config.
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
- [ ] **Schema Validation**: Use the TypeBox schemas from Phase 1 to validate all loaded configuration files.
- [ ] **Git Commit**: Make at least one commit after completing the tasks in this phase.

## Success Criteria
- Configuration files are correctly loaded and merged based on scope.
- Regex patterns in YAML correctly match tool arguments.
- Permission resolution follows the correct priority order.
