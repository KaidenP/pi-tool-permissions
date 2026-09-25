import { Type } from "typebox";
// Additional rule keys are part of the extension API for custom policies.
export const PermissionRuleSchema = Type.Object({
    tool: Type.String(),
    parameters: Type.Optional(Type.Record(Type.String(), Type.String())),
    policy: Type.String(),
    priority: Type.Optional(Type.Number({ default: 0 })),
}, { additionalProperties: true });
