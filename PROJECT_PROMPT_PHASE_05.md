# Phase 5: Testing & Refinement

## Overview
Verify the extension's functionality through comprehensive testing, handle edge cases, and finalize documentation.

## Tasks
- [ ] **Unit Tests**: Create a suite of unit tests for:
    - The regex parser (testing various patterns and argument types).
    - The priority resolver (verifying correct order of Global vs Project vs Always permissions).
    - Configuration loading logic.
- [ ] **Integration Tests**: Perform manual or automated integration tests to verify:
    - Built-in tools (`read`, `bash`, `edit`) are correctly blocked/allowed based on YAML config.
    - The TUI prompts appear correctly and capture user input.
    - "Always" permissions persist across different sessions and restarts.
- [ ] **Edge Case Handling**: 
    - Ensure the extension doesn't block its own required operations or critical system paths (e.g., `pi` internal commands).
    - Handle cases where a tool is not defined in any config (should default to `ask`).
    - Gracefully handle malformed YAML files without crashing the extension.
- [ ] **Documentation & Examples**: 
    - Create a comprehensive README for the extension.
    - Provide several example YAML configurations for common use cases (e.g., "Strict Mode", "Development Mode").
    - Document how to install and configure the extension.
- [ ] **Git Commit**: Make at least one commit after completing the tasks in this phase.

## Success Criteria
- All unit tests pass with 100% coverage of core logic.
- Integration tests confirm that all requirements from `PROJECT_PROMPT.md` are met.
- The extension is stable, handles edge cases gracefully, and has clear documentation for users.
