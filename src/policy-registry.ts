export type PolicyDecision = { decision: string; priority: number };
export class PolicyRegistry {
  private handlers = new Map<string, (rule: any) => PolicyDecision>();
  register(key: string, handler: (rule: any) => PolicyDecision) {
    this.handlers.set(key, handler);
  }
  resolve(rule: any): PolicyDecision {
    const handler = this.handlers.get(rule.policy);
    if (!handler) return { decision: "ask", priority: rule.priority ?? 0 };
    return handler(rule);
  }
}
