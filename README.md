# Pi Tool Permissions Extension

This extension implements a robust permissioning system for the Pi coding agent, allowing users to control which tools the agent can execute and with what parameters.

## Overview

The core objective of this extension is to move from a binary "trust all tools" or "deny all tools" model to a granular, policy-driven approach. It intercepts every tool call, evaluates it against a set of rules, and either allows it, denies it, or asks the user for consent.

### Key Features

- **Granular Control**: Define rules based on tool name and specific parameter patterns (using regex).
- **Hierarchical Configuration**: Rules can be defined at multiple levels:
    - **Global**: Apply to all projects.
    - **Project**: Apply to a specific project (stored in `.pi/permissions.yaml`).
    - **Project-Local**: Apply to a specific project but not committed to version control (stored in `.pi/permissions.local.yaml`).
    - **Session**: Apply only to the current session.
- **Dynamic Policies**: Supports custom policies (e.g., `allow`, `deny`, `ask`) that can be extended by other Pi extensions.
- **User Consent Workflow**: When a tool call is "asked", the user is prompted with a clear description of the action and a set of persistence choices.
- **Bypass Mode**: A toggleable mode that bypasses all permission checks for power users.
- **Audit Logging**: Logs all permission decisions to a local file for auditing.

## Requirements

- Node.js (compatible with the Pi coding agent environment)
- A Pi coding agent installation

## Installation

This extension should be installed according to the Pi extension mechanism.

## Configuration

Permissions are configured in YAML files. Each file contains a list of rules.

### Rule Format

A rule consists of:
- `tool`: The name of the tool to match.
- `policy`: The policy to apply (`allow`, `deny`, `ask`).
- `priority`: (Optional) An integer. Higher priority rules win.
- `parameters`: (Optional) A map of parameter names to regex patterns.

Example `permissions.yaml`:

```yaml
- tool: read
  policy: allow
  parameters:
    path: "^/home/user/my-project/src/.*"
- tool: bash
  policy: ask
- tool: write
  policy: deny
```

### Variable Substitution

The following variables can be used in parameter patterns:
- `${CWD}`: The current working directory.
- `${HOME}`: The user's home directory.

## Usage

### For Users

- **Approval Prompts**: When the agent wants to use a tool, you will see a prompt. You can:
  - **Deny**: Block the call.
  - **Allow once**: Allow only this specific call.
  - **Allow only in this session**: Persist the grant for the duration of the session.
  - **Allow always (Project-local)**: Persist the grant in `.pi/permissions.local.yaml`.
  - **Allow always (Project)**: Persist the grant in `.pi/permissions.yaml`.
  - **Allow always (Global)**: Persist the grant in the user's home directory.
- **Bypass Mode**: Use `Ctrl+Shift+B` or the `permission-bypass` command to toggle the bypass mode. When active, the status bar will show `BYPASS` and a warning widget will appear.

### For Developers

- **Custom Policies**: You can register new policies using the `registerPolicy` function or the `pi-tool-permissions:register-policy` event.
- **Custom Prompt Renderers**: You can customize how the prompt for a tool is presented to the user using `registerPromptRenderer`.

## Project Structure

- `src/index.ts`: Main extension entry point and middleware logic.
- `src/config-parser.ts`: Logic for loading and parsing YAML configuration files.
- `src/match-engine.ts`: The core logic for matching tool calls against rules.
- `src/persistence.ts`: Logic for writing permission rules to disk.
- `src/policy-registry.ts`: Policy management and evaluation.
- `src/prompt-builder.ts`: Logic for constructing approval prompts.
- `src/prompt-registry.ts`: Registry for custom prompt renderers.
- `src/parameter-normalizer.ts`: Normalizes tool parameters for consistent matching.
- `src/path-utils.ts`: Utilities for path normalization and pattern interpolation.
- `src/mode-manager.ts`: State management for bypass mode.
- `src/bypass-widget.ts`: UI components for the bypass mode indicator.
- `src/log.ts`: Audit logging.
- `src/renderers/`: Tool-specific prompt renderers.
- `src/types.ts`: Shared type definitions.
- `src/schemas.ts`: TypeBox schemas for configuration validation.
