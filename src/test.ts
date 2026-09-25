import { test, describe } from "node:test";
import assert from "node:assert";
import { PolicyRegistry } from "./policy-registry";
import { matchRule, resolveRules, normalizePath, interpolatePattern } from "./config-loader";

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
    assert.strictEqual(result.policy, "deny");
  });
});
