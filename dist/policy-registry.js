"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyRegistry = void 0;
class PolicyRegistry {
    handlers = new Map();
    constructor() {
        this.register("allow", (r) => ({ decision: "allow", priority: r.priority ?? 0 }));
        this.register("deny", (r) => ({ decision: "deny", priority: r.priority ?? 0 }));
        this.register("ask", (r) => ({ decision: "ask", priority: r.priority ?? 0 }));
    }
    register(key, handler) {
        this.handlers.set(key, handler);
    }
    resolve(rule) {
        const handler = this.handlers.get(rule?.policy);
        if (!handler)
            return { decision: "ask", priority: rule?.priority ?? 0 };
        return handler(rule);
    }
}
exports.PolicyRegistry = PolicyRegistry;
