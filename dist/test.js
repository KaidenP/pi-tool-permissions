"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const policy_registry_1 = require("./policy-registry");
const config_loader_1 = require("./config-loader");
(0, node_test_1.describe)("PolicyRegistry", () => {
    (0, node_test_1.test)("default allow/deny/ask registered", async () => {
        const reg = new policy_registry_1.PolicyRegistry();
        node_assert_1.default.strictEqual((await reg.resolve({ policy: "allow", priority: 1 })).decision, "allow");
        node_assert_1.default.strictEqual((await reg.resolve({ policy: "deny", priority: 2 })).decision, "deny");
        node_assert_1.default.strictEqual((await reg.resolve({ policy: "ask", priority: 3 })).decision, "ask");
    });
    (0, node_test_1.test)("unknown policy defaults to ask", async () => {
        const reg = new policy_registry_1.PolicyRegistry();
        node_assert_1.default.deepStrictEqual(await reg.resolve({ policy: "unknown" }), { decision: "ask", priority: 0 });
    });
});
(0, node_test_1.describe)("Config loader", () => {
    (0, node_test_1.test)("normalizePath resolves absolute paths", () => {
        const p = (0, config_loader_1.normalizePath)("foo/bar", "/home/user");
        node_assert_1.default.ok(p.includes("foo"));
    });
    (0, node_test_1.test)("interpolatePattern replaces variables", () => {
        const p = (0, config_loader_1.interpolatePattern)("${CWD}/x", "/cwd");
        node_assert_1.default.strictEqual(p, "/cwd/x");
    });
    (0, node_test_1.test)("matchRule matches exact tool and regex params", () => {
        const rule = { tool: "bash", parameters: { cmd: "rm.*" }, policy: "deny" };
        node_assert_1.default.strictEqual((0, config_loader_1.matchRule)(rule, "bash", { cmd: "rm -rf" }), true);
        node_assert_1.default.strictEqual((0, config_loader_1.matchRule)(rule, "bash", { cmd: "ls" }), false);
        node_assert_1.default.strictEqual((0, config_loader_1.matchRule)(rule, "read", {}), false);
    });
    (0, node_test_1.test)("resolveRules picks last matching highest priority", () => {
        const rules = [
            [{ tool: "bash", policy: "ask", priority: 1 }],
            [{ tool: "bash", policy: "deny", priority: 0 }],
        ];
        const result = (0, config_loader_1.resolveRules)(rules, "bash", {});
        node_assert_1.default.strictEqual(result.policy, "ask");
    });
});
