import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { getConfigPaths, getRuleSource, interpolatePattern, loadConfig, matchRule, normalizePath, normalizePathPattern, normalizeToolParams, parseConfig, resolveRules, } from "./config-loader.js";
import permissionExtension, { createPermissionHandler } from "./index.js";
import { trimLogFile } from "./log.js";
import { appendPermissionRule, createAllowRule } from "./persistence.js";
import { POLICY_REGISTRATION_EVENT, PolicyRegistry, policyRegistryInstance, } from "./policy-registry.js";
function makeTempDir() {
    return mkdtempSync(join(tmpdir(), "pi-tool-permissions-"));
}
function makeContext(options) {
    const { cwd, hasUI = true, trusted = true, sessionFile, selection, onSelect, } = options;
    return {
        cwd,
        hasUI,
        isProjectTrusted: () => trusted,
        sessionManager: { getSessionFile: () => sessionFile },
        ui: {
            select: async (title, choices) => {
                onSelect?.(title, choices);
                return selection;
            },
            notify: () => undefined,
        },
    };
}
function makeEvent(toolName, input) {
    return {
        type: "tool_call",
        toolCallId: "test-call-id",
        toolName,
        input,
    };
}
function writeYaml(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
}
function cleanup(path) {
    rmSync(path, { recursive: true, force: true });
}
describe("PolicyRegistry", () => {
    test("registers the built-in allow, deny, and ask handlers", async () => {
        const registry = new PolicyRegistry();
        const event = makeEvent("bash", { command: "pwd" });
        const extensionContext = makeContext({ cwd: process.cwd() });
        const context = {
            rule: { tool: "bash", policy: "allow", priority: 2 },
            event,
            extensionContext,
            cwd: process.cwd(),
            parameters: event.input,
        };
        assert.deepEqual(await registry.resolve("allow", 2, context), {
            decision: "allow",
            priority: 2,
        });
        assert.deepEqual(await registry.resolve("deny", 3, context), {
            decision: "deny",
            priority: 3,
        });
        assert.deepEqual(await registry.resolve("ask", 4, context), {
            decision: "ask",
            priority: 4,
        });
    });
    test("passes the winning policy, priority, rule, and event context to custom handlers", async () => {
        const registry = new PolicyRegistry();
        const event = makeEvent("custom_tool", { targetPath: "./secret" });
        const extensionContext = makeContext({ cwd: process.cwd() });
        const rule = { tool: "custom_tool", policy: "review", priority: 7, extensionData: "kept" };
        let handlerContext;
        registry.register("review", (context) => {
            handlerContext = context;
            return { decision: "deny", priority: context.priority };
        });
        const decision = await registry.resolve("review", 7, {
            rule,
            event,
            extensionContext,
            cwd: process.cwd(),
            parameters: event.input,
        });
        assert.deepEqual(decision, { decision: "deny", priority: 7 });
        assert.deepEqual(handlerContext, {
            policy: "review",
            priority: 7,
            rule,
            event,
            extensionContext,
            cwd: process.cwd(),
            parameters: event.input,
        });
    });
    test("unknown policy keys safely resolve to ask", async () => {
        const registry = new PolicyRegistry();
        const event = makeEvent("custom_tool", {});
        const decision = await registry.resolve("not-registered", 3, {
            rule: { tool: "custom_tool" },
            event,
            extensionContext: makeContext({ cwd: process.cwd() }),
            cwd: process.cwd(),
            parameters: {},
        });
        assert.deepEqual(decision, { decision: "ask", priority: 3 });
    });
    test("accepts policy registration through Pi's inter-extension event bus", async () => {
        const policyName = `test-policy-${Math.random()}`;
        let onRegistration;
        const registeredEvents = new Map();
        const pi = {
            events: {
                on(channel, handler) {
                    if (channel === POLICY_REGISTRATION_EVENT)
                        onRegistration = handler;
                    return () => undefined;
                },
            },
            on(event, handler) {
                registeredEvents.set(event, handler);
            },
        };
        permissionExtension(pi);
        assert.ok(onRegistration);
        onRegistration({
            key: policyName,
            handler: ({ priority }) => ({ decision: "deny", priority }),
        });
        const event = makeEvent("custom_tool", {});
        const decision = await policyRegistryInstance.resolve(policyName, 8, {
            rule: { tool: "custom_tool", policy: policyName },
            event,
            extensionContext: makeContext({ cwd: process.cwd() }),
            cwd: process.cwd(),
            parameters: {},
        });
        assert.deepEqual(decision, { decision: "deny", priority: 8 });
        assert.ok(registeredEvents.has("tool_call"));
        registeredEvents.get("session_shutdown")?.({}, {});
        const afterShutdown = await policyRegistryInstance.resolve(policyName, 8, {
            rule: { tool: "custom_tool", policy: policyName },
            event,
            extensionContext: makeContext({ cwd: process.cwd() }),
            cwd: process.cwd(),
            parameters: {},
        });
        assert.deepEqual(afterShutdown, { decision: "ask", priority: 8 });
    });
});
describe("Configuration parsing and resolution", () => {
    test("preserves extra keys and records source metadata without overwriting a source key", () => {
        const temp = makeTempDir();
        try {
            const file = join(temp, "permissions.yaml");
            writeYaml(file, "- tool: bash\n  policy: deny\n  priority: 1\n  source: extension-data\n  futureOption:\n    enabled: true\n");
            const rules = loadConfig(file);
            assert.equal(rules.length, 1);
            assert.equal(rules[0].source, "extension-data");
            assert.deepEqual(rules[0].futureOption, { enabled: true });
            assert.equal(rules[0].priority, 1);
            assert.equal(getRuleSource(rules[0]), file);
        }
        finally {
            cleanup(temp);
        }
    });
    test("accepts empty and comment-only files", () => {
        assert.deepEqual(parseConfig("", "empty.yaml"), []);
        assert.deepEqual(parseConfig("# No permission rules yet\n", "comments.yaml"), []);
    });
    test("rejects malformed YAML, non-array documents, scalar rules, and missing required keys", () => {
        assert.throws(() => parseConfig("- tool: [", "broken.yaml"), /YAML decode failure/);
        assert.throws(() => parseConfig("tool: bash\npolicy: allow\n", "object.yaml"), /array/);
        assert.throws(() => parseConfig("- null\n", "null-rule.yaml"), /rule 1/);
        assert.throws(() => parseConfig("- tool: bash\n", "missing-policy.yaml"), /rule 1/);
    });
    test("loadConfig exits nonzero for rules missing required keys", () => {
        const temp = makeTempDir();
        try {
            const file = join(temp, "invalid.yaml");
            writeYaml(file, "- tool: bash\n");
            const loaderUrl = new URL("./config-loader.js", import.meta.url).href;
            const script = `import { loadConfig } from ${JSON.stringify(loaderUrl)}; loadConfig(${JSON.stringify(file)});`;
            const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
                encoding: "utf8",
            });
            assert.equal(child.status, 1, child.stderr || child.stdout);
        }
        finally {
            cleanup(temp);
        }
    });
    test("uses the documented paths and only derives a session file from JSONL", () => {
        const temp = makeTempDir();
        try {
            const cwd = join(temp, "project");
            const home = join(temp, "home");
            const sessionFile = join(temp, "session.jsonl");
            const paths = getConfigPaths(cwd, sessionFile, home);
            assert.equal(paths.global, join(home, CONFIG_DIR_NAME, "agent", "permissions.yaml"));
            assert.equal(paths.project, join(cwd, CONFIG_DIR_NAME, "permissions.yaml"));
            assert.equal(paths.projectLocal, join(cwd, CONFIG_DIR_NAME, "permissions.local.yaml"));
            assert.equal(paths.session, join(temp, "session.permissions.yaml"));
            assert.equal(getConfigPaths(cwd, undefined, home).session, undefined);
            assert.equal(getConfigPaths(cwd, join(temp, "unexpected.txt"), home).session, undefined);
        }
        finally {
            cleanup(temp);
        }
    });
    test("normalizes existing and future paths to absolute canonical paths", () => {
        const temp = makeTempDir();
        try {
            const realDirectory = join(temp, "real");
            const aliasDirectory = join(temp, "alias");
            mkdirSync(realDirectory);
            writeFileSync(join(realDirectory, "file.txt"), "content");
            symlinkSync(realDirectory, aliasDirectory);
            assert.equal(normalizePath("alias/file.txt", temp), normalizePath("real/file.txt", temp));
            assert.equal(normalizePath("alias/new/../new/file.txt", temp), join(realDirectory, "new", "file.txt"));
            assert.ok(normalizePath("missing/target", temp).startsWith(temp));
        }
        finally {
            cleanup(temp);
        }
    });
    test("normalizes only path-valued arguments, not command strings", () => {
        const temp = makeTempDir();
        try {
            const parameters = normalizeToolParams("bash", { command: "echo ./relative/path", timeout: 1000 }, temp);
            assert.equal(parameters.command, "echo ./relative/path");
            const readParameters = normalizeToolParams("read", { path: "./file.txt" }, temp);
            assert.equal(readParameters.path, normalizePath("./file.txt", temp));
        }
        finally {
            cleanup(temp);
        }
    });
    test("matches normalized paths, symlinks, interpolated variables, and regex suffixes", () => {
        const temp = makeTempDir();
        try {
            const cwd = join(temp, "project.v1");
            const realDirectory = join(cwd, "real");
            const aliasDirectory = join(cwd, "alias");
            mkdirSync(realDirectory, { recursive: true });
            writeFileSync(join(realDirectory, "file.txt"), "content");
            symlinkSync(realDirectory, aliasDirectory);
            const relativeRule = {
                tool: "read",
                parameters: { path: "alias/file\\.txt" },
                policy: "allow",
                priority: 0,
            };
            assert.equal(matchRule(relativeRule, "read", { path: "real/file.txt" }, cwd), true);
            const variableRule = {
                tool: "read",
                parameters: { path: "^${CWD}/real/.*\\.txt$" },
                policy: "allow",
                priority: 0,
            };
            assert.equal(matchRule(variableRule, "read", { path: "alias/file.txt" }, cwd), true);
            const wildcardRule = {
                tool: "read",
                parameters: { path: ".*" },
                policy: "allow",
                priority: 0,
            };
            assert.equal(matchRule(wildcardRule, "read", { path: join(temp, "outside.txt") }, cwd), true);
            assert.equal(interpolatePattern("${CWD}/x", cwd), `${normalizePath(cwd, cwd)}/x`);
            assert.ok(normalizePathPattern("${CWD}/real/.*", cwd).startsWith("/"));
        }
        finally {
            cleanup(temp);
        }
    });
    test("matches exact tool names and all specified parameters; omitted parameters are wildcards", () => {
        const rule = { tool: "bash", parameters: { command: "rm.*" }, policy: "deny", priority: 0 };
        assert.equal(matchRule(rule, "bash", { command: "rm -rf build" }), true);
        assert.equal(matchRule(rule, "bash", { command: "ls" }), false);
        assert.equal(matchRule(rule, "bash", {}), false);
        assert.equal(matchRule({ tool: "bash", policy: "allow" }, "bash", { command: "ls" }), true);
        assert.equal(matchRule(rule, "read", { command: "rm -rf build" }), false);
    });
    test("resolves priority first, then last matching rule, with a virtual ask fallback", () => {
        const scopedRules = [
            [{ tool: "bash", policy: "deny", priority: 2 }],
            [{ tool: "bash", policy: "allow", priority: 2 }],
            [{ tool: "bash", policy: "ask", priority: 1 }],
        ];
        assert.equal(resolveRules(scopedRules, "bash", {}).policy, "allow");
        const higherPriority = [
            [{ tool: "bash", policy: "deny", priority: 1 }],
            [{ tool: "bash", policy: "allow", priority: 4 }],
            [{ tool: "bash", policy: "ask", priority: 2 }],
        ];
        assert.equal(resolveRules(higherPriority, "bash", {}).policy, "allow");
        const fallback = resolveRules([[{ tool: "bash", policy: "deny", priority: 0 }]], "read", {});
        assert.equal(fallback.policy, "ask");
        assert.equal(fallback.priority, 0);
        assert.equal(fallback.virtual, true);
    });
});
describe("Persistence and logging", () => {
    test("escapes approved arguments and appends without losing unknown rule keys", () => {
        const temp = makeTempDir();
        try {
            const file = join(temp, "permissions.yaml");
            writeYaml(file, "- tool: bash\n  policy: ask\n  extensionFlag: preserve-me\n");
            const rule = createAllowRule("bash", { command: "echo (safe).*" }, 2);
            appendPermissionRule(file, rule);
            const rules = loadConfig(file);
            assert.equal(rules.length, 2);
            assert.equal(rules[0].extensionFlag, "preserve-me");
            assert.equal(rules[1].parameters?.command, "^echo \\(safe\\)\\.\\*$");
            assert.equal(matchRule(rules[1], "bash", { command: "echo (safe).*" }), true);
            assert.equal(matchRule(rules[1], "bash", { command: "echo safeX" }), false);
        }
        finally {
            cleanup(temp);
        }
    });
    test("trims the permission log to the latest 500 non-empty lines", () => {
        const temp = makeTempDir();
        try {
            const file = join(temp, "permissions.log");
            writeFileSync(file, Array.from({ length: 505 }, (_, index) => `line ${index}`).join("\n"));
            trimLogFile(file);
            const lines = readFileSync(file, "utf8").trimEnd().split("\n");
            assert.equal(lines.length, 500);
            assert.equal(lines[0], "line 5");
            assert.equal(lines.at(-1), "line 504");
        }
        finally {
            cleanup(temp);
        }
    });
});
describe("Tool-call permission middleware", () => {
    test("intercepts read, bash, and edit built-in tools and terminates denied calls", async () => {
        const temp = makeTempDir();
        try {
            const home = join(temp, "home");
            const cwd = join(temp, "project");
            const paths = getConfigPaths(cwd, undefined, home);
            writeYaml(paths.global, "- tool: read\n  policy: deny\n- tool: bash\n  policy: deny\n- tool: edit\n  policy: deny\n");
            const handler = createPermissionHandler({ homeDir: home, logger: () => undefined });
            const ctx = makeContext({ cwd, hasUI: false });
            const calls = [
                makeEvent("read", { path: "secret.txt" }),
                makeEvent("bash", { command: "cat secret.txt" }),
                makeEvent("edit", { path: "secret.txt", edits: [] }),
            ];
            for (const event of calls) {
                const result = await handler(event, ctx);
                assert.equal(result.block, true);
                assert.equal(result.terminate, true);
            }
        }
        finally {
            cleanup(temp);
        }
    });
    test("defaults unmatched calls to ask and denies safely when no UI is available", async () => {
        const temp = makeTempDir();
        try {
            let selectCalled = false;
            const handler = createPermissionHandler({
                homeDir: join(temp, "home"),
                logger: () => undefined,
            });
            const ctx = {
                ...makeContext({ cwd: join(temp, "project"), hasUI: false }),
                ui: {
                    select: async () => {
                        selectCalled = true;
                        return "Allow once";
                    },
                    notify: () => undefined,
                },
            };
            const result = await handler(makeEvent("custom_tool", { value: "x" }), ctx);
            assert.equal(result.block, true);
            assert.equal(result.terminate, true);
            assert.equal(selectCalled, false);
        }
        finally {
            cleanup(temp);
        }
    });
    test("shows the tool name and arguments, and a project-local grant overrides older ask rules", async () => {
        const temp = makeTempDir();
        try {
            const home = join(temp, "home");
            const cwd = join(temp, "project");
            const paths = getConfigPaths(cwd, undefined, home);
            writeYaml(paths.global, '- tool: bash\n  parameters:\n    command: ".*"\n  policy: ask\n  priority: 5\n');
            let promptTitle = "";
            let promptChoices = [];
            const logs = [];
            const handler = createPermissionHandler({
                homeDir: home,
                logger: (tool, action, source) => logs.push([tool, action, source]),
            });
            const event = makeEvent("bash", { command: "echo hi" });
            const uiContext = makeContext({
                cwd,
                selection: "Allow always (Project-local)",
                onSelect: (title, choices) => {
                    promptTitle = title;
                    promptChoices = choices;
                },
            });
            const firstResult = await handler(event, uiContext);
            assert.equal(firstResult.block, false);
            assert.match(promptTitle, /Permission required for bash/);
            assert.match(promptTitle, /"command": "echo hi"/);
            assert.deepEqual(promptChoices, [
                "Deny",
                "Allow once",
                "Allow only in this session",
                "Allow always (Project-local)",
                "Allow always (Project)",
                "Allow always (Global)",
            ]);
            const savedRules = loadConfig(paths.projectLocal);
            assert.equal(savedRules.length, 1);
            assert.equal(savedRules[0].policy, "allow");
            assert.equal(savedRules[0].priority, 6);
            assert.equal(savedRules[0].parameters?.command, "^echo hi$");
            assert.ok(logs.some(([, action]) => action === "Asked"));
            const noUiContext = makeContext({ cwd, hasUI: false });
            const secondResult = await handler(event, noUiContext);
            assert.equal(secondResult.block, false);
        }
        finally {
            cleanup(temp);
        }
    });
    test("persists session, project, and global grants to their selected scopes", async () => {
        const cases = [
            { choice: "Allow only in this session", scope: "session" },
            { choice: "Allow always (Project)", scope: "project" },
            { choice: "Allow always (Global)", scope: "global" },
        ];
        for (const testCase of cases) {
            const temp = makeTempDir();
            try {
                const home = join(temp, "home");
                const cwd = join(temp, "project");
                const sessionFile = join(temp, "session.jsonl");
                const paths = getConfigPaths(cwd, sessionFile, home);
                const expectedPath = paths[testCase.scope];
                assert.ok(expectedPath);
                const event = makeEvent("bash", { command: "echo persistent" });
                const firstHandler = createPermissionHandler({
                    homeDir: home,
                    logger: () => undefined,
                });
                const firstContext = makeContext({
                    cwd,
                    sessionFile,
                    selection: testCase.choice,
                });
                assert.equal((await firstHandler(event, firstContext)).block, false);
                assert.equal(existsSync(expectedPath), true, `${testCase.scope} rule was not saved`);
                const restartedHandler = createPermissionHandler({
                    homeDir: home,
                    logger: () => undefined,
                });
                const noUiContext = makeContext({ cwd, sessionFile, hasUI: false });
                assert.equal((await restartedHandler(event, noUiContext)).block, false);
            }
            finally {
                cleanup(temp);
            }
        }
    });
    test("keeps ephemeral session grants in memory only for this handler instance", async () => {
        const temp = makeTempDir();
        try {
            const home = join(temp, "home");
            const cwd = join(temp, "project");
            const event = makeEvent("custom_tool", { value: "session-only" });
            const logs = [];
            const handler = createPermissionHandler({
                homeDir: home,
                logger: (tool, action, source) => logs.push([tool, action, source]),
            });
            const grantingContext = makeContext({
                cwd,
                selection: "Allow only in this session",
            });
            assert.equal((await handler(event, grantingContext)).block, false);
            const noUiContext = makeContext({ cwd, hasUI: false });
            assert.equal((await handler(event, noUiContext)).block, false);
            assert.ok(logs.some(([, action, source]) => action === "Allowed" && source === "session memory (ephemeral session)"));
            const freshHandler = createPermissionHandler({ homeDir: home, logger: () => undefined });
            assert.equal((await freshHandler(event, noUiContext)).block, true);
            assert.equal(existsSync(getConfigPaths(cwd, undefined, home).global), false);
        }
        finally {
            cleanup(temp);
        }
    });
    test("passes extension-owned rule data and event context to a registered policy", async () => {
        const temp = makeTempDir();
        try {
            const home = join(temp, "home");
            const cwd = join(temp, "project");
            const paths = getConfigPaths(cwd, undefined, home);
            writeYaml(paths.project, "- tool: custom_tool\n  policy: inspect\n  priority: 3\n  extensionData: keep-this\n");
            const registry = new PolicyRegistry();
            const event = makeEvent("custom_tool", { targetPath: "./secret" });
            const extensionContext = makeContext({ cwd });
            let sawContext = false;
            registry.register("inspect", ({ rule, event: receivedEvent, extensionContext: receivedContext }) => {
                sawContext =
                    rule.extensionData === "keep-this" &&
                        receivedEvent === event &&
                        receivedContext === extensionContext;
                return { decision: "deny", priority: 3 };
            });
            const handler = createPermissionHandler({
                homeDir: home,
                logger: () => undefined,
                registry,
            });
            const result = await handler(event, extensionContext);
            assert.equal(result.block, true);
            assert.equal(sawContext, true);
        }
        finally {
            cleanup(temp);
        }
    });
    test("keeps an explicitly approved project grant effective in-session while trust is pending", async () => {
        const temp = makeTempDir();
        try {
            const home = join(temp, "home");
            const cwd = join(temp, "project");
            const paths = getConfigPaths(cwd, undefined, home);
            const event = makeEvent("bash", { command: "pwd" });
            const handler = createPermissionHandler({ homeDir: home, logger: () => undefined });
            const untrustedUi = makeContext({
                cwd,
                trusted: false,
                selection: "Allow always (Project-local)",
            });
            assert.equal((await handler(event, untrustedUi)).block, false);
            assert.equal(existsSync(paths.projectLocal), true);
            assert.equal((await handler(event, makeContext({ cwd, trusted: false, hasUI: false }))).block, false);
            const freshHandler = createPermissionHandler({ homeDir: home, logger: () => undefined });
            assert.equal((await freshHandler(event, makeContext({ cwd, trusted: false, hasUI: false }))).block, true);
            assert.equal((await freshHandler(event, makeContext({ cwd, trusted: true, hasUI: false }))).block, false);
        }
        finally {
            cleanup(temp);
        }
    });
    test("does not honor project permission files until Pi trusts the project", async () => {
        const temp = makeTempDir();
        try {
            const home = join(temp, "home");
            const cwd = join(temp, "project");
            const paths = getConfigPaths(cwd, undefined, home);
            writeYaml(paths.project, "- tool: bash\n  policy: allow\n");
            const handler = createPermissionHandler({ homeDir: home, logger: () => undefined });
            const context = makeContext({ cwd, trusted: false, hasUI: false });
            const result = await handler(makeEvent("bash", { command: "pwd" }), context);
            assert.equal(result.block, true);
        }
        finally {
            cleanup(temp);
        }
    });
});
