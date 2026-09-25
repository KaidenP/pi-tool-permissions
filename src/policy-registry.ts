export type PolicyDecision = { decision: string; priority: number };

export class PolicyRegistry {
  private handlers = new Map<string, (rule: any) => Promise<PolicyDecision>>();
  constructor() {
    this.register("allow", async (r) => ({ decision: "allow", priority: r.priority ?? 0 }));
    this.register("deny", async (r) => ({ decision: "deny", priority: r.priority ?? 0 }));
    this.register("ask", async (r) => ({ decision: "ask", priority: r.priority ?? 0 }));
  }
  register(key: string, handler: (rule: any) => Promise<PolicyDecision>) {
    this.handlers.set(key, handler);
  }
  async resolve(rule: any): Promise<PolicyDecision> {
    const handler = this.handlers.get(rule?.policy);
    if (!handler) return { decision: "ask", priority: rule?.priority ?? 0 };
    return await handler(rule);
  }
}
