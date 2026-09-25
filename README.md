# Pi Tool Permissions Extension

Manages tool-call permissions with granular overrides via YAML config files.

## Install

`npm install`

## Profiles

- **Strict**: deny all except `read`
- **Developer**: allow `bash`/`edit` with `ask`
- **Trusted**: allow all

## Example `permissions.yaml`

```yaml
- tool: bash
  parameters:
    command: "rm -rf .*"
  policy: deny
  priority: 5
```

## Scopes (highest to lowest priority)

1. Global (`~/CONFIG_DIR_NAME/agent/permissions.yaml`)
2. Project (`CONFIG_DIR_NAME/permissions.yaml`)
3. Project Local (`CONFIG_DIR_NAME/permissions.local.yaml`)
4. Session (`.permissions.yaml` derived from session file)

## Features

- TypeBox schema validation
- Regex parameter matching with wildcards
- Path normalization (`${CWD}`, `${HOME}` interpolation)
- Priority-based resolution with tie-breaking
- Security logging (`~/CONFIG_DIR_NAME/agent/logs/permissions.log`, trimmed to 500 lines)
