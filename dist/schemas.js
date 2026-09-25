import { Type } from "typebox";
export const PermissionRuleSchema = Type.Object({
    tool: Type.String(),
    parameters: Type.Optional(Type.Record(Type.String(), Type.String())),
    policy: Type.String(),
    priority: Type.Optional(Type.Number({ default: 0 })),
});
