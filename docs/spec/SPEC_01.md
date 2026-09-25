# Phase 1: Configuration Engine & Foundation

## Overview
Initialize the project structure and implement the logic to load, parse, and resolve permissions from YAML configuration files. This phase establishes the "source of truth" for the permission system.

## Technical Requirements
- **Language**: TypeScript / Node.js.
- **Dependencies**: `typebox` (schema validation), `js-yaml` (parsing), `@earendil-works/pi-coding-agent` (types and `CONFIG_DIR_NAME` constant).
- **Configuration Paths**:
  Use the `CONFIG_DIR_NAME` constant from `@earendil-works/pi-coding-agent`.
  | Scope | Path |
  | :--- | :--- |
  | Global | `~/CONFIG_DIR_NAME/agent/permissions.yaml` |
  | Project | `ctx.cwd/CONFIG_DIR_NAME/permissions.yaml` |
  | Project Local | `ctx.cwd/CONFIG_DIR_NAME/permissions.local.yaml` |
  | Session | Derived from `ctx.sessionManager.getSessionFile()` (replace `.jsonl` with `.permissions.yaml`); in-memory only if ephemeral |

## Tasks
- [ ] **Project Initialization**:
    - Setup TypeScript project structure.
    - Initialize `package.json` and install dependencies: `typebox`, `js-yaml`, `@earendil-works/pi-coding-agent`.
    - Ensure necessary directory structures exist (e.g., `~/CONFIG_DIR_NAME/agent/logs/`).
- [ ] **Configuration Schema**:
    - Define TypeBox schemas in `src/schemas.ts` to validate the structure of the permission files.
    - **Validation Failure Behavior**: If YAML decoding fails or required keys (`tool`, `policy`) are missing, exit the process. Extra/unknown keys in config objects must be preserved (not stripped) so that future extensions can use additional keys in rules.
    - Syntax:
      ```yaml
      - tool: "<tool_name>"
        parameters:
          "<param_name>": "<regex>"
        policy: "<policy_key>" # e.g., allow, deny, ask
        priority: <number>        # Optional, defaults to 0
      ```
- [ ] **YAML Loader & Regex Parser**:
    - Implement logic to load the four configuration scopes. Exit the process if YAML decoding fails or required keys (`tool`, `policy`) are missing in any rule. Preserve extra/unknown keys in rules (do not clean/remove them) to allow future extensions to use added keys.
    - **Path Normalization**: Ensure all incoming tool arguments (paths) and configuration patterns are normalized to absolute paths, resolving `..`, `.`, and symlinks before matching.
    - **Variable Interpolation**: Before matching, replace `${CWD}` with the current working directory and `${HOME}` with the user's home directory in the configuration regex.
    - **Matching Logic**: A rule matches if the `tool` name is exactly equal AND all specified `parameters` exist in the tool call and match the provided regex. 
    - **Wildcards**: Parameters omitted from the `parameters` block are treated as wildcards (match any value).
- [ ] **Priority Resolver**:
    - Implement resolution by concatenating rules from all sources into a single array.
    - **Evaluation Order**: Global -> Project -> Project Local -> Session.
    - **Rule Winner**:
      1. Filter for all matching entries.
      2. Sort by `priority` descending.
      3. If priorities are equal, the last entry in the array (lowest scope/most local) wins.
      4. If no rules match, apply a virtual `ask` policy with priority 0.
      5. The winning rule's `policy` key and `priority` are passed to the `PolicyRegistry`.
- [ ] **Policy Registry**:
    - Implement a singleton `PolicyRegistry` that allows other extensions to register handlers for specific `policy` keys.
    - Define a `PolicyDecision` return type: `{ decision: 'allow' | 'deny' | 'ask' | string , priority: number }`.
    - Provide default handlers for `allow`, `deny`, and `ask`.
- [ ] **Permission Logging**: 
    - Implement a logger that records every tool call to `~/CONFIG_DIR_NAME/agent/logs/permissions.log`.
    - Include: Tool name, Timestamp, Action (Allowed/Denied/Asked), and the specific config file that triggered the decision.
    - limit the log to 500 lines (trim from top after each write)

## Success Criteria
- Config files are correctly loaded and merged from all four scopes.
- Regex patterns correctly match tool arguments with wildcard support.
- Permission resolution follows the specified priority order.
- All inputs are validated against TypeBox schemas.
