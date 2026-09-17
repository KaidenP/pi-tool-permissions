# Phase 1: Project Setup & Foundation

## Overview
Initialize the project structure, install dependencies, and create the basic extension skeleton for the Pi Tool Permissions Extension. Reference: [Pi Extensions Documentation](docs/extensions.md#writing-an-extension) (Lines 100-200).

## Tasks
...
- [ ] **Project Initialization**: Create a directory structure suitable for a TypeScript project and initialize a Git repository.
- [ ] **Git Commit**: Make at least one commit after initializing the project structure and git repo.
- [ ] **Dependency Management**: Initialize `package.json` and install:
    - `typebox`: For schema validation of configuration files.
    - `js-yaml`: For parsing the YAML configuration files.
    - `@earendil-works/pi-coding-agent`: The core Pi extension types.
    - `typescript`, `@types/node`: Development dependencies.
- [ ] **Extension Skeleton**: Create `src/index.ts` as the entry point for the extension. It should export a default function that receives the `ExtensionAPI`.
- [ ] **Configuration Schema**: Define TypeBox schemas in `src/schemas.ts` to validate:
    - The structure of project and global configuration files (`permissions.yaml`, `permissions.local.yaml`).
    - The tool and argument patterns using the specified YAML syntax.
- [ ] **Permission Logging**: Implement a logging system that creates and maintains a log file at `~/$CONFIG_DIR_NAME/agent/logs/permissions.log`. This logger must record every tool call with the following details:
    - Tool name
    - Timestamp
    - Approval status (Approved / Denied)
    - Authorization reason (e.g., which permission file authorized it, or if the user specifically authorized it).
  Use the `tool_call` event from the Pi Extension API to intercept and log these calls, utilizing `ctx.ui` for any required user confirmations as described in the documentation.

## Success Criteria
- A working project structure with all dependencies installed.
- An extension skeleton that can be loaded by Pi without errors.
- Validated schemas for the YAML configuration files.
