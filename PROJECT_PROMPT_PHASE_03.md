# Phase 3: Validation & Refinement

## Overview
Verify the extension's functionality through comprehensive testing, handle edge cases, and finalize documentation.

## Tasks
- [ ] **Unit Tests**: Create a suite of tests for:
    - The regex parser (testing complex patterns and wildcard behavior).
    - The priority resolver (verifying Global $\rightarrow$ Project $\rightarrow$ Local $\rightarrow$ Session priority).
    - Configuration loading and schema validation.
- [ ] **Integration Tests**: 
    - Verify that built-in tools (`read`, `bash`, `edit`) are correctly managed.
    - Confirm that TUI prompts function correctly across different modes.
    - Verify persistence of "Always" permissions across session restarts.
- [ ] **Edge Case Handling**: 
    - **Self-Protection**: Ensure the extension does not block its own configuration files or critical `pi` system paths.
    - **Robustness**: Gracefully handle malformed YAML files (log error and default to `ask` rather than crashing).
    - **Performance**: Ensure the config resolution does not introduce noticeable latency to tool calls.
- [ ] **Documentation**: 
    - Write a `README.md` explaining how to install and use the extension.
    - Provide example `permissions.yaml` templates for different profiles (e.g., "Strict", "Developer", "Trusted").

## Success Criteria
- All unit tests pass with high coverage of the resolution logic.
- Integration tests confirm all requirements from the main project prompt are met.
- Extension handles malformed configs and system paths without failure.
- User documentation is clear and includes working examples.
