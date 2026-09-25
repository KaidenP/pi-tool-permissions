export const RULE_SOURCE = Symbol("permission-rule-source");

export type PermissionRuleRecord = Record<string, unknown> & {
  tool: string;
  policy: string;
  priority: number;
  parameters?: Record<string, string>;
  virtual?: boolean;
  [RULE_SOURCE]?: string;
};
