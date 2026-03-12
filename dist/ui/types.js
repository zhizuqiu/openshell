// 定义 role enum
export var CustomMultiMessageRole;
(function (CustomMultiMessageRole) {
    CustomMultiMessageRole["SYSTEM"] = "system";
    CustomMultiMessageRole["USER"] = "user";
    CustomMultiMessageRole["ASSISTANT"] = "assistant";
})(CustomMultiMessageRole || (CustomMultiMessageRole = {}));
// type enum 定义
export var AssistantMessageType;
(function (AssistantMessageType) {
    AssistantMessageType["TOOL_CALL"] = "tool_call";
    AssistantMessageType["TEXT"] = "text";
})(AssistantMessageType || (AssistantMessageType = {}));
export var DecisionType;
(function (DecisionType) {
    DecisionType["APPROVE"] = "approve";
    DecisionType["EDIT"] = "edit";
    DecisionType["REJECT"] = "reject";
})(DecisionType || (DecisionType = {}));
//# sourceMappingURL=types.js.map