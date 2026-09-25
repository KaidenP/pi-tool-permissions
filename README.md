# Pi Tool Permissions Extension

A Pi extension that evaluates tool calls against layered YAML permission rules. Matching rules can allow, deny, or ask the user; unmatched calls default to asking. In modes without a dialog UI, an ask is denied.

This gates Pi's LLM `tool_call` event only. It is not an OS sandbox and does not constrain extension code, user-run shell commands, or other local processes. Use a container or VM for untrusted or unattended work.

## Install

From a local checkout:

```bash
npm install
npm test
pi install /absolute/path/to/pi-tool-permissions
```

For a temporary test without installing the package:

```bash
pi -e ./src/index.ts
```

The package declares its extension entry point in `package.json`, so `pi install` can discover it as a Pi package. Project-local extension packages are subject to Pi's normal project-trust checks.

## Configuration files and precedence

The extension reads these files in this order:

1. **Global:** `~/${CONFIG_DIR_NAME}/agent/permissions.yaml`
2. **Project:** `ctx.cwd/${CONFIG_DIR_NAME}/permissions.yaml`
3. **Project local:** `ctx.cwd/${CONFIG_DIR_NAME}/permissions.local.yaml`
4. **Session:** the current session filename with `.jsonl` replaced by `.permissions.yaml`

Pi's default `CONFIG_DIR_NAME` is `.pi`. Project and project-local permission files are only honored after Pi trusts the project; global and session rules are still evaluated otherwise. If a user selects a project scope before trust is granted, that explicit grant is mirrored in memory for the current session and Pi reports that project trust is needed after restart. If the session is ephemeral, session-only grants are held in memory for that session instance.

Rules from the scopes are concatenated in the order above. The matching rule with the highest numeric `priority` wins (the default is `0`); if priorities tie, the last matching rule wins. When no rule matches, a virtual `ask` rule with priority `0` is used.

## Rule syntax

Each file contains a YAML array:

```yaml
- tool: read
  parameters:
    path: "^${CWD}/src/.*\\.ts$"
  policy: allow
  priority: 1

- tool: bash
  parameters:
    command: "\\brm\\s+-rf\\b.*"
  policy: deny
  priority: 10
```

- `tool` must exactly match the Pi tool name.
- Every supplied `parameters` entry must exist in the tool call and match its JavaScript regular expression. Parameters omitted from the block are wildcards. Regex matching uses `RegExp.test`, so use `^` and `$` when you need to constrain the whole value.
- Path-valued arguments (such as `path`, `filePath`, and `directory`) and the literal path prefix of path patterns are resolved to absolute canonical paths. Existing symlinks are resolved; non-existent targets are resolved through their nearest existing parent. Non-path values such as bash `command` strings are not rewritten.
- `${CWD}` and `${HOME}` are expanded in patterns at evaluation time. Relative path patterns are resolved against the current working directory.
- Extra rule keys are preserved and passed to custom policy handlers.

## Built-in profiles

### Strict

Allow reads inside the project except `.env`; deny common mutation/execution tools. Unlisted tools still require user approval.

```yaml
- tool: read
  parameters:
    path: "^${CWD}/.*"
  policy: allow
  priority: 1
- tool: read
  parameters:
    path: "^${CWD}/\\.env$"
  policy: deny
  priority: 10
- tool: bash
  policy: deny
  priority: 10
- tool: edit
  policy: deny
  priority: 10
- tool: write
  policy: deny
  priority: 10
```

### Developer

Ask for normal commands, but reject an obvious recursive-delete command before prompting.

```yaml
- tool: bash
  parameters:
    command: "\\brm\\s+-rf\\b.*"
  policy: deny
  priority: 5
- tool: bash
  policy: ask
  priority: 1
- tool: edit
  policy: ask
  priority: 1
- tool: write
  policy: ask
  priority: 1
```

### Trusted

Allow the selected built-in tools without prompting. This is intentionally broad; only use it in environments where that is appropriate.

```yaml
- tool: bash
  policy: allow
- tool: read
  policy: allow
- tool: edit
  policy: allow
- tool: write
  policy: allow
```

## User prompts and persistence

For an `ask` decision in TUI or RPC mode, the extension shows the tool name and its arguments and offers:

- **Allow once** — no rule is saved.
- **Allow only in this session** — saved in the session permissions file, or in memory for an ephemeral session.
- **Allow always (Project-local)** — appended to `permissions.local.yaml`.
- **Allow always (Project)** — appended to `permissions.yaml`.
- **Allow always (Global)** — appended to the global permissions file.

Saved grants use escaped, anchored patterns for each supplied argument, are appended to the selected file, and receive a priority above currently matching rules so the choice takes effect immediately. If saving fails after explicit approval, the current call is allowed once and the UI reports that the grant was not persisted.

In print and JSON modes Pi has no dialog UI, so calls that would ask are denied. RPC mode supports Pi's extension UI protocol and can display the same prompt.

## Custom policies

The singleton registry is exported from the package entry point. For extensions with separate Pi package roots, register through Pi's shared event bus (emit during `session_start` so registration is not missed if extension load order differs):

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PolicyHandler } from "pi-tool-permissions";

export default function (pi: ExtensionAPI) {
  const handler: PolicyHandler = async ({ priority }) => {
    // Apply a project-specific assessment. Custom decisions other than
    // "allow" or "deny" follow the normal user-prompt path.
    return { decision: "ask", priority };
  };

  pi.on("session_start", () => {
    pi.events.emit("pi-tool-permissions:register-policy", {
      key: "risk-review",
      handler,
    });
  });
}
```

Handlers receive the selected policy key, rule priority, complete tool-call event, Pi extension context, normalized parameters, and the original rule (including unknown keys). They return `{ decision: "allow" | "deny" | "ask" | string, priority: number }`. An unregistered policy key safely falls back to `ask`. Extensions sharing the same installed module instance may instead import and call its `registerPolicy()` helper directly.

## Security log

Every evaluated decision is recorded in:

```text
~/${CONFIG_DIR_NAME}/agent/logs/permissions.log
```

Each line contains an ISO timestamp, tool name, action, and the config file or decision source. The log is trimmed to the latest 500 entries after each write.
