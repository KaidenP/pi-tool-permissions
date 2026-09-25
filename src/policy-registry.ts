export type PolicyDecision = { decision: string; priority: number };

export class PolicyRegistry {
  private handlers = new Map<string, (rule: any) => PolicyDecision>();
  constructor() {
    this.register("allow", (r) => ({ decision: "allow", priority: r.priority ?? 0 }));
    this.register("deny", (r) => ({ decision: "deny", priority: r.priority ?? 0 }));
    this.register("ask", (r) => ({ decision: "ask", priority: r.priority ?? 0 }));
  }
  register(key: string, handler: (rule: any) => PolicyDecision) {
    this.handlers.set(key, handler);
  }
  resolve(rule: any): PolicyDecision {
    const handler = this.handlers.get(rule?.policy);
    if (!handler) return { decision: "ask", priority: rule?.priority ?? 0 };
    return handler(rule);
  }
}
