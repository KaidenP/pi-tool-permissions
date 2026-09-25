import { test, describe } from "node:test";
import assert from "node:assert";
import { writeFileSync, unlinkSync } from "node:fs";
import { PolicyRegistry } from "./policy-registry.js";
import { matchRule, resolveRules, normalizePath, interpolatePattern, loadConfig } from "./config-loader.js";
describe("PolicyRegistry", () => {
    test("default allow/deny/ask registered", async () => {
        const reg = new PolicyRegistry();
        assert.strictEqual((await reg.resolve({ policy: "allow", priority: 1 })).decision, "allow");
        assert.strictEqual((await reg.resolve({ policy: "deny", priority: 2 })).decision, "deny");
        assert.strictEqual((await reg.resolve({ policy: "ask", priority: 3 })).decision, "ask");
    });
    test("unknown policy defaults to ask", async () => {
        const reg = new PolicyRegistry();
        assert.deepStrictEqual(await reg.resolve({ policy: "unknown" }), { decision: "ask", priority: 0 });
    });
});
describe("Config loader", () => {
    test("normalizePath resolves absolute paths", () => {
        const p = normalizePath("foo/bar", "/home/user");
        assert.ok(p.includes("foo"));
    });
    test("interpolatePattern replaces variables", () => {
        const p = interpolatePattern("${CWD}/x", "/cwd");
        assert.strictEqual(p, "/cwd/x");
    });
    test("matchRule matches exact tool and regex params", () => {
        const rule = { tool: "bash", parameters: { cmd: "rm.*" }, policy: "deny" };
        assert.strictEqual(matchRule(rule, "bash", { cmd: "rm -rf" }), true);
        assert.strictEqual(matchRule(rule, "bash", { cmd: "ls" }), false);
        assert.strictEqual(matchRule(rule, "read", {}), false);
    });
    test("resolveRules picks last matching highest priority", () => {
        const rules = [
            [{ tool: "bash", policy: "ask", priority: 1 }],
            [{ tool: "bash", policy: "deny", priority: 0 }],
        ];
        const result = resolveRules(rules, "bash", {});
        assert.strictEqual(result.policy, "ask");
    });
    test("resolveRules returns virtual ask when no rules match", () => {
        const result = resolveRules([[{ tool: "bash", policy: "deny" }]], "read", {});
        assert.strictEqual(result.policy, "ask");
        assert.strictEqual(result.priority, 0);
    });
    test("resolveRules tie-breaks to last entry", () => {
        const rules = [
            [{ tool: "bash", policy: "deny", priority: 2 }],
            [{ tool: "bash", policy: "allow", priority: 2 }],
        ];
        const result = resolveRules(rules, "bash", {});
        assert.strictEqual(result.policy, "allow");
    });
});
describe("Configuration loading", () => {
    test("loadConfig preserves extra keys", () => {
        const tmpFile = "/tmp/test_permissions_extra.yaml";
        writeFileSync(tmpFile, "- tool: bash\n  policy: deny\n  priority: 1\n  extraKey: value\n");
        const rules = loadConfig(tmpFile);
        assert.strictEqual(rules.length, 1);
        assert.strictEqual(rules[0].extraKey, "value");
        assert.strictEqual(rules[0].source, tmpFile);
        unlinkSync(tmpFile);
    });
    test("loadConfig handles empty file", () => {
        const tmpFile = "/tmp/test_permissions_empty.yaml";
        writeFileSync(tmpFile, "");
        const rules = loadConfig(tmpFile);
        assert.strictEqual(rules.length, 0);
        unlinkSync(tmpFile);
    });
});
