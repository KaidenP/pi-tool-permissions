# Pi Tool Permissions Extension

Manages tool-call permissions with granular overrides via YAML configuration files. It provides a security layer where the agent must request user permission before executing certain tools or accessing specific files/paths, while allowing granular overrides via configuration scopes.

## Install

```bash
npm install
```

Add the extension to your pi configuration (e.g., `~/.pi/agent/extensions/` or `.pi/extensions/`) and restart the agent.

## Profiles

### Strict
Deny all tool execution except for safe `read` operations.

```yaml
# Strict profile (e.g., permissions.yaml)
- tool: bash
  policy: deny
  priority: 10
- tool: edit
  policy: deny
  priority: 10
- tool: read
  policy: allow
  priority: 0
```

### Developer
Allow common development tools (`bash`, `edit`) but require confirmation (`ask`) for potentially destructive commands.

```yaml
# Developer profile (e.g., permissions.local.yaml)
- tool: bash
  parameters:
    command: "rm -rf .*"
  policy: deny
  priority: 5
- tool: bash
  policy: ask
  priority: 1
- tool: edit
  policy: ask
  priority: 1
```

### Trusted
Allow all built-in tools without restriction.

```yaml
# Trusted profile (e.g., permissions.yaml)
- tool: bash
  policy: allow
  priority: 0
- tool: read
  policy: allow
  priority: 0
- tool: edit
  policy: allow
  priority: 0
```

## Example `permissions.yaml`

```yaml
- tool: bash
  parameters:
    command: "rm -rf .*"
  policy: deny
  priority: 5
- tool: bash
  policy: ask
  priority: 1
```

## Scopes (highest to lowest priority)

1. **Global** (`~/CONFIG_DIR_NAME/agent/permissions.yaml`)
2. **Project** (`CONFIG_DIR_NAME/permissions.yaml` inside `ctx.cwd`)
3. **Project Local** (`CONFIG_DIR_NAME/permissions.local.yaml` inside `ctx.cwd`)
4. **Session** (derived from `ctx.sessionManager.getSessionFile()`; replaced `.jsonl` with `.permissions.yaml`)

Rules are concatenated in scope order, with the highest priority matching rule winning. If priorities tie, the last defined rule wins (lowest scope / most local). If no rules match, a virtual `ask` policy with priority `0` is applied.

## Configuration Syntax

```yaml
- tool: "<tool_name>"
  parameters:
    "<param_name>": "<regex>"
  policy: "<policy_key>"  # e.g., allow, deny, ask
  priority: <number>      # Optional, defaults to 0
```

- **Parameters**: Each parameter is matched against the provided regex. Omitted parameters act as wildcards (match any value).
- **Path Normalization**: All path arguments and regex patterns are normalized to absolute paths before matching.
- **Variable Interpolation**: Patterns support `${CWD}` (current working directory) and `${HOME}` (user home directory).
- **Extra Keys**: Unknown/extra keys in rules are preserved (not stripped) so future extensions can rely on them.

## Features

- TypeBox schema validation for permission rules
- Regex parameter matching with wildcard support
- Dynamic path variables (`${CWD}`, `${HOME}`) and path normalization
- Priority-based resolution with tie-breaking (last defined rule wins)
- Singleton `PolicyRegistry` for extensible policy handlers (`allow`, `deny`, `ask`, plus custom keys)
- Security logging (`~/CONFIG_DIR_NAME/agent/logs/permissions.log`, trimmed to 500 lines) that records tool name, timestamp, action, and source config file
- TUI prompts (`ctx.ui.select`) for `ask` actions with persistence choices:
  - Allow once
  - Allow only in this session (persisted to session file; in-memory for ephemeral sessions)
  - Allow always (Project-local, Project, or Global)

## Success Criteria

- The agent cannot execute a tool without permission unless explicitly allowed by config or user consent.
- The TUI correctly captures and persists "Always" permissions to the correct scope.
- The configuration parser correctly handles regex patterns for arguments.
- The system is robust against malformed config files (exits on YAML decode failure or missing `tool`/`policy` keys, preserves extra keys).
