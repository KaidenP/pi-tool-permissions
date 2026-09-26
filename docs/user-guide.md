# User Guide

This guide explains how to use and configure the Pi Tool Permissions extension.

## How it Works

When the Pi agent wants to use a tool, the Permissions extension checks if it has permission to do so. 

- If a rule **allows** the call, the tool runs immediately.
- If a rule **denies** the call, the tool is blocked.
- If the rule is **ask** (or no rule exists), you will be prompted to decide.

## Managing Permissions

### Approval Prompts

When prompted, you have several options:

| Option | Effect | Storage Location |
| :--- | :--- | :--- |
| **Deny** | Blocks the current call. | Not stored. |
| **Allow once** | Allows only this specific call. | Not stored. |
| **Allow only in this session** | Allows this call for the rest of the session. | Session config file. |
| **Allow always (Project-local)** | Allows this call for this project (private). | `.pi/permissions.local.yaml` |
| **Allow always (Project)** | Allows this call for this project (shared). | `.pi/permissions.yaml` |
| **Allow always (Global)** | Allows this call across all your projects. | `~/.config/pi/agent/permissions.yaml` |

### Bypass Mode

If you are in a trusted environment and find the prompts intrusive, you can enable **Bypass Mode**.

- **Toggle**: Use `Ctrl+Shift+B` or the `permission-bypass` command.
- **Indicator**: When active, the status bar will show `BYPASS` in red, and a warning widget will appear in the UI.
- **Effect**: All permission checks are skipped.

## Configuration

You can manually edit permission files to define your own rules.

### Example Configuration

```yaml
# Global permissions: ~/.config/pi/agent/permissions.yaml
- tool: read
  policy: allow
  parameters:
    path: "^/home/user/.ssh/config$" # Allow reading a specific file

- tool: bash
  policy: ask # Always ask before running bash commands

# Project permissions: .pi/permissions.yaml
- tool: write
  policy: allow
  parameters:
    path: "\${CWD}/dist/.*" # Allow writing to the dist folder of the current project
```

### Using Variables

To make rules portable across different machines or projects, use these variables in your regex patterns:

- `${CWD}`: Replaced with the absolute path of the current project root.
- `${HOME}`: Replaced with the absolute path of your user home directory.

### Priority

If multiple rules match a tool call, the one with the **highest priority** wins. Priority is an optional integer (defaults to 0). When you select "Allow" from a prompt, the extension automatically assigns a priority one higher than the rule that triggered the prompt.
