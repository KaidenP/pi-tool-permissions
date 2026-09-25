# Plan: Custom Prompt UI for Tool Permissions (Per-Tool & Extensible)

## Goal
Allow 3rd-party extensions to replace the default `select()` prompt with custom TUI/rendered content for specific tools (e.g., show a diff for `edit` instead of raw JSON args). Other extensions should be able to register custom UI for their own tools.

## Current State
- `makePromptTitle()` in `src/index.ts` builds a plain-text title.
- `ctx.ui.select()` shows raw JSON arguments — hard to interpret for `edit`.
- No hook exists for extensions to inject a custom prompt component.

## Proposed Design

### 1. Prompt Renderer Registry (`src/prompt-registry.ts` — new)
- Singleton `PromptRendererRegistry` with `register(toolName | pattern, renderer)`.
- Renderer interface receives `(event, normalizedParams, ctx) => PromptUI`.
- `PromptUI` can be either:
  - `{ kind: "default", title, body?, choices? }` — falls back to `ctx.ui.select()`
  - `{ kind: "custom", component: Component, choices?: ChoiceConfig[] }` — uses `ctx.ui.custom()` or returns a custom component; choices can still map back to allow/deny actions

### 2. Default Renderer Updates (`src/index.ts`)
- Default `edit` renderer builds a diff view from `normalizedParameters` (`path`, `edits` array) and renders it in the prompt.
- Default `bash` renderer can format `command` with syntax highlighting or risk badges.
- All other tools keep current text behavior.

### 3. Extension API (`src/index.ts` exports)
- Export `registerPromptRenderer(pattern, renderer)`.
- Export `PromptRenderer`, `PromptUI`, `ChoiceConfig` types.

### 4. Usage Example — Edit Diff
```typescript
import { registerPromptRenderer } from "pi-tool-permissions";
registerPromptRenderer("edit", (event, params, ctx) => ({
  kind: "custom",
  title: `Edit: ${params.path}`,
  component: renderDiffComponent(params.edits),
  choices: [
    { label: "Deny", action: "deny" },
    { label: "Allow once", action: "allow-once" },
    ...
  ],
}));
```

### 5. Usage Example — 3rd-Party Tool
```typescript
registerPromptRenderer("my_custom_tool", (event, params) => ({
  kind: "default",
  title: `My Tool: ${params.action}`,
  body: customFormattedBody(params),
  choices: defaultChoices,
}));
```

### 6. Implementation Steps
1. Define `PromptUI`, `ChoiceConfig`, and renderer interface in `src/schemas.ts` or new file.
2. Create `src/prompt-registry.ts` with singleton registry and lookup by tool name.
3. Modify `createPermissionHandler` in `src/index.ts`:
   - After resolving the winning rule and before calling `ctx.ui.select()`, query registry.
   - If a custom renderer exists for `event.toolName`, invoke it.
   - If `kind === "custom"`, use `ctx.ui.custom()` (or equivalent) to display the component and collect choice/input.
   - If `kind === "default"`, pass the returned title/body/choices to existing `select()` flow.
4. Add default `edit` renderer that formats edits as unified diff for display.
5. Export `registerPromptRenderer` from package entry.
6. Update docs (`README.md`, `docs/plan-prompt-customization.md`).

### 7. Security / Backward Compatibility
- If a renderer throws, fall back to default `select()` behavior (fail-safe).
- Existing policy registry (`registerPolicy`) untouched.
- No persistence format changes.
- Custom UI only affects the prompt display; decision mapping (`allow`, `deny`, `ask`) remains the same.
