# Bypass-Permissions Mode — Implementation Plan

**Status:** Feasible per pi docs (`extensions.md`, `keybindings.md`, `settings.md`, `skills.md`)  
**Scope:** Extension-level feature within `pi-tool-permissions` project.

---

## 1. Capability Verification (Docs Confirmed)

| Requirement | Doc Evidence | Feasible? |
|---|---|---|
| Slash command to switch mode | `pi.registerCommand()` (`extensions.md`) | **Yes** |
| Status widget | `ctx.ui.setStatus()` / `setWidget()` (`extensions.md`) | **Yes** |
| Keybind toggle | `pi.registerShortcut()` (`extensions.md` line 174) | **Yes** |
| Two permission modes (Default / Bypass) | Custom state + event interception (`tool_call`) | **Yes** |
| Red alert widget for bypass | `theme.fg("error", ...)` + widget rendering (`extensions.md` theme colors) | **Yes** |

---

## 2. Architecture

### 2.1 Modes
- `default`: Existing permission rules apply (`allow`/`deny`/`ask`).
- `permission-bypass`: All `tool_call` events return `{ block: false }` (or equivalent pass-through) without permission checks; bypass state is tracked in memory/session.

### 2.2 Components
1. **Mode State Manager** (`src/mode-manager.ts`): Tracks current mode (`default` | `permission-bypass`).
2. **Slash Command** (`/bypass-mode` or `/permission-mode`): Toggles mode via `registerCommand`.
3. **Shortcut Toggle** (`ctrl+shift+b` or user-configurable): `registerShortcut` calls same toggle handler.
4. **Status Footer** (`ctx.ui.setStatus`): Shows mode name; red (`theme.fg("error", ...)`) when bypass.
5. **Widget** (`ctx.ui.setWidget`): Red text widget displayed while bypass is active to alert user.
6. **Tool Interceptor** (`pi.on("tool_call")`): Reads mode; skips permission gates when bypass is active; logs to security log.

---

## 3. Implementation Phases with Quality Gates

### Phase 1: Foundation & Mode State
- [ ] Create `src/mode-manager.ts` with `ModeState` singleton (`default` / `permission-bypass`).
- [ ] Add TypeBox schema for mode persistence (optional session storage).
- **Quality Gate (QG1):** Unit test asserts mode starts `default`; toggle switches to `permission-bypass`; second toggle returns to `default`.

### Phase 2: Slash Command
- [ ] Implement `registerCommand("bypass-mode")` (or `/permission-bypass`).
- [ ] Command calls `modeState.toggle()` and notifies via `ctx.ui.notify()`.
- **Quality Gate (QG2):** Integration test executes command in mock context; verifies mode change and notification emitted.

### Phase 3: Shortcut / Keybind Toggle
- [ ] Implement `registerShortcut("ctrl+shift+b", { handler })`.
- [ ] Shortcut invokes same toggle logic.
- **Quality Gate (QG3):** Key event simulation confirms toggle fires; no deadlock in TUI mode (`ctx.mode === "tui"` guard if needed).

### Phase 4: Red Widget & Status
- [ ] `on("session_start")`: Initialize `ctx.ui.setWidget("permission-bypass", [redLine])` when in bypass; clear when default.
- [ ] Red styling: use `theme.fg("error", "BYPASS ACTIVE")` or hardcoded red ANSI/style.
- [ ] `ctx.ui.setStatus("permissions", modeString)` with red color when bypass.
- **Quality Gate (QG4):** Visual assertion: widget present + red in bypass mode; absent in default mode; footer status matches.

### Phase 5: Tool Call Integration
- [ ] In existing `tool_call` interceptor: check `modeState.current`. If `permission-bypass`, log bypass and skip gate (return undefined / allow).
- [ ] Security log (`permissions.log`) must record `BYPASS` action.
- **Quality Gate (QG5):** Mock `tool_call` event: default mode triggers ask/deny logic; bypass mode passes through; log entry verified.

### Phase 6: Session Persistence & Cleanup
- [ ] Persist mode to session file (optional) so it survives reload (`session_shutdown` / `session_start`).
- [ ] Clear widget/status on `session_shutdown` to prevent leaks.
- **Quality Gate (QG6):** Reload test: mode survives `/reload`; widget/status restored; no memory leak.

---

## 4. Red Alert Design Spec

- **Widget text:** `[BYPASS MODE] — Permissions disabled` (red).
- **Status footer text:** `BYPASS` (red) vs `DEFAULT` (muted/dim).
- **Trigger:** Only when `mode === "permission-bypass"`.
- **Implementation note:** Use `theme.fg("error", text)` inside widget rendering; fallback to ANSI `\x1b[31m` if theme unavailable.

---

## 5. Risk & Mitigation

| Risk | Mitigation |
|---|---|
| Bypass accidentally left on | Auto-clear on session start? No — user intent; rely on red widget + status as persistent alert. |
| Keybind conflicts with built-in (`ctrl+p`) | Use `ctrl+shift+b` (not used by model cycle or editor). Configurable in `keybindings.json`. |
| RPC / JSON mode has no TUI widget | Guard with `ctx.hasUI`; skip widget/status in non-TUI modes or use no-op. |
| Security log overflow | Reuse existing 500-line trim logic (`SPEC_01.md`). |

---

## 6. Acceptance Criteria

- [ ] User types `/permission-bypass` (or configured slash command) → mode toggles; notification shown.
- [ ] User presses `ctrl+shift+b` → same toggle; no command-line interaction needed.
- [ ] When bypass is active: widget appears red; footer status red; `tool_call` events bypass permission gate.
- [ ] When default: widget hidden; footer muted; normal `ask`/`allow`/`deny` rules apply.
- [ ] All changes covered by quality gates QG1–QG6.
- [ ] Every phase concludes with logical Git commit (`docs/spec/README.md` requirement).

---

## 7. File Targets

```
src/
  mode-manager.ts          # State + toggle logic
  bypass-widget.ts          # Widget/status renderer (red styling)
  index.ts                  # Extension entry: register command, shortcut, events, interceptor
```
