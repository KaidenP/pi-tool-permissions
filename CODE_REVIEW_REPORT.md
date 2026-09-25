# Code Review Report — pi-tool-permissions

## File Overview
- `src/index.ts` — 318 lines: middleware, prompt logic, persistence, exports.
- `src/config-loader.ts` — 744 lines (largest): parsing, normalization, regex, matching, resolution.
- `src/test.ts` — 695 lines: extensive unit/integration tests (good coverage).
- `src/persistence.ts`, `src/log.ts`, `src/policy-registry.ts`, `src/prompt-registry.ts`
- `src/renderers/*.ts` — small per-tool renderers (clean).

## Key Issues

### 1. `src/index.ts` is too large (318 lines)
Functions: `resolveChoice`, `makePromptTitle`, `priorityForNewAllowRule`, `denied`, `createPermissionHandler`, `default` export. The middleware function inside `createPermissionHandler` is ~170 lines with nested persistence logic. 
**Propose**: Split persistence logic (scope selection, file writing, memory rules) into `src/persistence-handler.ts`. Split UI/prompt building into `src/prompt-builder.ts`.

### 2. `src/config-loader.ts` is massive (744 lines) and does too much
Contains: YAML parsing, path normalization, regex interpolation, rule matching, priority resolution, path parameter detection. 
**Propose**: Split into:
- `src/config-parser.ts` (`parseConfig`, `loadConfig`, `failConfig`, schema validation)
- `src/path-utils.ts` (`normalizePath`, `normalizePathPattern`, `interpolatePattern`, `expandToolPath`, `canonicalizeIncludingMissingTail`)
- `src/match-engine.ts` (`matchRule`, `resolveRules`, `escapeRegExp`, regex helpers)
- `src/parameter-normalizer.ts` (`normalizeToolParams`, `isPathParameter`, `parameterValueToString`)

### 3. Mixed concerns in middleware (`createPermissionHandler`)
It handles: event validation, config loading, policy resolution, UI interaction, persistence, error handling, logging. 
**Propose**: Extract a `PermissionEvaluator` class or pure function that takes `event` and `paths` and returns the decision scope, leaving the handler to manage UI/persistence only.

### 4. `src/test.ts` is very long (695 lines)
Tests cover registry, parsing, persistence, and middleware integration. 
**Propose**: Split into `tests/test-policy-registry.ts`, `tests/test-config-loader.ts`, `tests/test-middleware.ts`, `tests/test-persistence.ts`.

### 5. Minor cleanups
- `src/index.ts` has dead/commented code in `renderers/edit.ts` (commented diff rendering). Either implement or delete.
- `log.ts` trims after every write; fine but could batch.
- `renderers/read.ts` computes `endVal` with nested ternaries; simplify.

## Recommended Actions (prioritized)
1. Split `config-loader.ts` into 4 focused modules.
2. Split `index.ts` middleware into `middleware/core.ts` and `middleware/persistence.ts`.
3. Split tests into per-feature files.
4. Clean up dead code in renderers and simplify `read.ts` line math.
5. Keep exports and public API unchanged (backward compat).
