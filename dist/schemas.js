"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionRuleSchema = void 0;
const typebox_1 = require("typebox");
exports.PermissionRuleSchema = typebox_1.Type.Object({
    tool: typebox_1.Type.String(),
    parameters: typebox_1.Type.Optional(typebox_1.Type.Record(typebox_1.Type.String(), typebox_1.Type.String())),
    policy: typebox_1.Type.String(),
    priority: typebox_1.Type.Optional(typebox_1.Type.Number({ default: 0 })),
});
