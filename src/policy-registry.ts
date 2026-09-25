import type {
  ExtensionContext,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";

export type PolicyDecision = {
  decision: string;
  priority: number;
};

/** Context supplied to a policy implementation for each tool call. */
export interface PolicyHandlerContext {
  policy: string;
  priority: number;
  rule: Readonly<Record<string, unknown>>;
  event: ToolCallEvent;
  extensionContext: ExtensionContext;
  cwd: string;
  parameters: Readonly<Record<string, unknown>>;
}

export type PolicyHandler = (
  context: PolicyHandlerContext,
) => PolicyDecision | Promise<PolicyDecision>;

export class PolicyRegistry {
  private readonly handlers = new Map<string, { handler: PolicyHandler }>();

  constructor() {
    this.register("allow", ({ priority }) => ({ decision: "allow", priority }));
    this.register("deny", ({ priority }) => ({ decision: "deny", priority }));
    this.register("ask", ({ priority }) => ({ decision: "ask", priority }));
  }

  register(key: string, handler: PolicyHandler): () => void {
    if (key.trim().length === 0) throw new Error("Policy keys cannot be empty");
    const registration = { handler };
    this.handlers.set(key, registration);
    return () => {
      // Do not remove a newer handler that replaced this registration.
      if (this.handlers.get(key) === registration) this.handlers.delete(key);
    };
  }

  unregister(key: string): boolean {
    return this.handlers.delete(key);
  }

  async resolve(
    policy: string,
    priority: number,
    context: Omit<PolicyHandlerContext, "policy" | "priority">,
  ): Promise<PolicyDecision> {
    const registration = this.handlers.get(policy);
    if (!registration) return { decision: "ask", priority };

    const result = await registration.handler({ ...context, policy, priority });
    if (
      !result ||
      typeof result.decision !== "string" ||
      !Number.isFinite(result.priority)
    ) {
      throw new TypeError(`Policy handler "${policy}" returned an invalid decision`);
    }
    return result;
  }
}

/** Shared event-bus channel for policy extensions using separate package roots. */
export const POLICY_REGISTRATION_EVENT = "pi-tool-permissions:register-policy";

/** Shared registry, importable by extensions that provide custom policies. */
export const policyRegistryInstance = new PolicyRegistry();

export function registerPolicy(key: string, handler: PolicyHandler): void {
  policyRegistryInstance.register(key, handler);
}
