"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyRegistry = void 0;
class PolicyRegistry {
    handlers = new Map();
    constructor() {
        this.register("allow", async (r) => ({ decision: "allow", priority: r.priority ?? 0 }));
        this.register("deny", async (r) => ({ decision: "deny", priority: r.priority ?? 0 }));
        this.register("ask", async (r) => ({ decision: "ask", priority: r.priority ?? 0 }));
    }
    register(key, handler) {
        this.handlers.set(key, handler);
    }
    async resolve(rule) {
        const handler = this.handlers.get(rule?.policy);
        if (!handler)
            return { decision: "ask", priority: rule?.priority ?? 0 };
        return await handler(rule);
    }
}
exports.PolicyRegistry = PolicyRegistry;
