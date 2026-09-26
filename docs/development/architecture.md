# Architecture Overview

The Pi Tool Permissions extension acts as a middleware layer between the Pi agent's tool call initiation and the actual execution. It implements a "fail-closed" security model where any tool call not explicitly allowed or asked is treated as requiring consent.

## Core Components

### 1. Middleware Layer (`src/index.ts`)
The `createPermissionHandler` function creates a middleware that intercepts `tool_call` events. It coordinates the flow:
`Tool Call` -> `Parameter Normalization` -> `Rule Matching` -> `Policy Resolution` -> `(Optional) User Prompt` -> `Persistence` -> `Allow/Deny`.

### 2. Match Engine (`src/match-engine.ts`)
The match engine handles the logic of determining which rule applies to a given tool call. 
- It supports regex-based matching for parameters.
- It handles path normalization to prevent bypasses via relative paths or symlinks.
- It implements a priority-based winning rule selection.

### 3. Policy Registry (`src/policy-registry.ts`)
Instead of hard-coding "allow" or "deny", the extension uses a `PolicyRegistry`. This allows other extensions to define what a specific policy means. For example, a security extension could register a `strict-audit` policy that allows the call but triggers a high-priority alert.

### 4. Persistence Layer (`src/persistence.ts` & `src/middleware/persistence.ts`)
Handles the storage of user-approved rules.
- Rules are stored in YAML format.
- Atomic writes (write-then-rename) are used to prevent file corruption.
- Supports multiple scopes: Global, Project, Project-Local, and Session.

### 5. Prompt System (`src/prompt-builder.ts` & `src/prompt-registry.ts`)
Manages how the user is asked for permission.
- `PromptRenderer` allows for tool-specific prompts (e.g., showing the actual bash command).
- Users are provided with options to control the scope and duration of the grant.

## Data Flow

1. **Interception**: A `tool_call` event is triggered.
2. **Normalization**: `parameter-normalizer.ts` and `path-utils.ts` ensure that paths are absolute and consistent.
3. **Resolution**: `match-engine.ts` looks through the rule hierarchy (Global < Project < Project-Local < Session) and picks the rule with the highest priority.
4. **Policy Evaluation**: The `PolicyRegistry` evaluates the winning rule's policy.
5. **User Interaction**: If the policy is `ask`, the `PromptRenderer` creates a human-readable prompt, and `ctx.ui.select` is used to get the user's choice.
6. **Persistence**: If the user grants permission for more than "once", the rule is written to the appropriate YAML file via `persistence.ts`.

## Development Guide

### Adding a New Tool-Specific Prompt
To change how a tool's permission prompt looks:
1. Create a new file in `src/renderers/`.
2. Use `registerPromptRenderer(toolName, (event, params) => { ... })`.
3. Import the renderer in `src/index.ts`.

### Adding a New Policy
To implement a new policy behavior:
1. Use `registerPolicy(policyName, (context) => { ... })`.
2. The handler must return a `PolicyDecision` containing a `decision` string (`allow`, `deny`, or `ask`) and a `priority`.

### Testing
Tests are located in the `tests/` directory. They primarily focus on:
- Config loading and parsing.
- Rule matching logic.
- Persistence of rules.
- Middleware behavior.
