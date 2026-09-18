# Project: Pi Tool Permissions Extension - Implementation Plan

## Overview
Create a pi extension that manages toolcall permissions. The goal is to provide a security layer where the agent must request user permission before executing certain tools or accessing specific files/paths, while allowing for granular overrides via configuration.

The system is designed to be extensible, allowing other extensions to register custom policy handlers (e.g., an AI-driven risk assessment) that can be triggered via the configuration. The built-in policy keys are `allow`, `deny`, and `ask`.

**General Requirement**: Every phase of this project must conclude with a logical Git commit.

---

## Quick Links
- [Phase 1: Configuration Engine & Foundation](PROJECT_PROMPT_PHASE_01.md)
- [Phase 2: Interception & User Interaction](PROJECT_PROMPT_PHASE_02.md)
- [Phase 3: Validation & Refinement](PROJECT_PROMPT_PHASE_03.md)

---

## Phase 1: Configuration Engine & Foundation
Focuses on the "source of truth".
- **Setup**: Project init and dependency installation (`typebox`, `js-yaml`).
- **Schemas**: Define strict validation for permission rules.
- **Loader**: Implement loading for Global, Project, Project Local, and Session scopes.
- **Logic**: Build a regex-based matching parser and a priority-based resolver. 
  - **Priority**: Rules can define an optional `priority` (default 0). The rule with the highest priority wins; if priorities tie, the last defined rule wins.
  - **Extensibility**: Implement a `PolicyRegistry` where handlers for specific policy keys (e.g., `allow`, `deny`, `ask`) can be registered. Extensions may register custom policy keys.
- **Logging**: Implement a security log for all permission decisions.

## Phase 2: Interception & User Interaction
Focuses on the runtime bridge between config and the user.
- **Interception**: Hook into `tool_call` and evaluate actions (`allow`, `deny`, `ask`).
- **UI**: Implement TUI prompts for `ask` actions using `ctx.ui`.
- **Persistence**: Implement the mechanism to save "Allow Always" decisions to the appropriate config file.
- **Defaults**: Establish a "default to ask" security posture.

## Phase 3: Validation & Refinement
Focuses on stability and usability.
- **Testing**: Unit tests for the resolver/parser and integration tests for built-in tools.
- **Robustness**: Handle malformed YAML and ensure system paths are protected.
- **Docs**: Create README and example configuration profiles.

---

## Technical Specifications
- **Language**: TypeScript / Node.js.
- **Schema Validation**: TypeBox.
- **Regex Support**: Parameters must match regex; omitted parameters are wildcards. 
- **Dynamic Paths**: Support `${CWD}` and `${HOME}` variables in configuration patterns, resolved at runtime.
- **Path Normalization**: All paths must be normalized (absolute paths, resolving `..`, `.`, and symlinks) before permission matching.
  1. Global (`~/CONFIG_DIR_NAME/agent/permissions.yaml`)
  2. Project (`CONFIG_DIR_NAME/permissions.yaml`)
  3. Project Local (`CONFIG_DIR_NAME/permissions.local.yaml`)
  4. Session (Derived from `ctx.sessionManager.getSessionFile()`; in-memory only if ephemeral)
- **Extension API**: Use `ExtensionAPI` and the `CONFIG_DIR_NAME` constant from `@earendil-works/pi-coding-agent`.

## Success Criteria
- The agent cannot execute a tool without permission unless explicitly allowed by config or user consent.
- The TUI correctly captures and persists "Always" permissions to the correct scope.
- The configuration parser correctly handles regex patterns for arguments.
- The system is robust against malformed config files.
