export class PolicyRegistry {
    handlers = new Map();
    constructor() {
        this.register("allow", ({ priority }) => ({ decision: "allow", priority }));
        this.register("deny", ({ priority }) => ({ decision: "deny", priority }));
        this.register("ask", ({ priority }) => ({ decision: "ask", priority }));
    }
    register(key, handler) {
        if (key.trim().length === 0)
            throw new Error("Policy keys cannot be empty");
        const registration = { handler };
        this.handlers.set(key, registration);
        return () => {
            // Do not remove a newer handler that replaced this registration.
            if (this.handlers.get(key) === registration)
                this.handlers.delete(key);
        };
    }
    unregister(key) {
        return this.handlers.delete(key);
    }
    async resolve(policy, priority, context) {
        const registration = this.handlers.get(policy);
        if (!registration)
            return { decision: "ask", priority };
        const result = await registration.handler({ ...context, policy, priority });
        if (!result ||
            typeof result.decision !== "string" ||
            !Number.isFinite(result.priority)) {
            throw new TypeError(`Policy handler "${policy}" returned an invalid decision`);
        }
        return result;
    }
}
/** Shared event-bus channel for policy extensions using separate package roots. */
export const POLICY_REGISTRATION_EVENT = "pi-tool-permissions:register-policy";
/** Shared registry, importable by extensions that provide custom policies. */
export const policyRegistryInstance = new PolicyRegistry();
export function registerPolicy(key, handler) {
    policyRegistryInstance.register(key, handler);
}
