import { test, describe } from "node:test";
import assert from "node:assert";
import { PolicyRegistry } from "./policy-registry";

describe("PolicyRegistry", () => {
  test("priority resolver: higher number wins", () => {
    const reg = new PolicyRegistry();
    reg.register("allow", (r) => ({ decision: "allow", priority: r.priority ?? 0 }));
    assert.strictEqual(reg.resolve({ policy: "allow", priority: 5 }).priority, 5);
  });
  test("unknown policy defaults to ask", () => {
    const reg = new PolicyRegistry();
    assert.deepStrictEqual(reg.resolve({ policy: "unknown" }), { decision: "ask", priority: 0 });
  });
});
