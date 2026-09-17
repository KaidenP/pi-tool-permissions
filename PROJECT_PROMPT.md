# Project: Pi Tool Permissions Extension - Implementation Plan

## Overview
Create a pi extension that manages toolcall permissions. The goal is to provide a security layer where the agent must request user permission before executing certain tools or accessing specific files/paths, while allowing for granular overrides via configuration.

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
- **Logic**: Build a regex-based matching parser and a "last match wins" priority resolver.
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
- **Priority**: Rules are concatenated and evaluated top-to-bottom (last match wins).
  1. Global (`~/CONFIG_DIR_NAME/agent/permissions.yaml`)
  2. Project (`CONFIG_DIR_NAME/permissions.yaml`)
  3. Project Local (`CONFIG_DIR_NAME/permissions.local.yaml`)
  4. Session (Derived from `ctx.sessionManager.getSessionFile()`)
- **Extension API**: Use `ExtensionAPI` and the `CONFIG_DIR_NAME` constant from `@earendil-works/pi-coding-agent`.

## Success Criteria
- The agent cannot execute a tool without permission unless explicitly allowed by config or user consent.
- The TUI correctly captures and persists "Always" permissions to the correct scope.
- The configuration parser correctly handles regex patterns for arguments.
- The system is robust against malformed config files.
