export declare enum CustomMultiMessageRole {
    SYSTEM = "system",
    USER = "user",
    ASSISTANT = "assistant"
}
export interface Message {
    role: CustomMultiMessageRole.SYSTEM | CustomMultiMessageRole.USER | CustomMultiMessageRole.ASSISTANT;
    content: string | AssistantMessage[];
    timestamp: Date;
    streaming?: boolean;
    error?: boolean;
}
export declare enum AssistantMessageType {
    TOOL_CALL = "tool_call",
    TEXT = "text"
}
export interface AssistantMessage {
    type: AssistantMessageType.TOOL_CALL | AssistantMessageType.TEXT;
    tool_calls?: ToolCall[];
    content?: string;
}
export interface ToolCall {
    name: string;
    args: {
        [key: string]: any;
    };
    id?: string;
    type?: string;
    interrupt?: Interrupt;
    decisions?: Decisions;
    result?: string;
}
interface ActionRequest {
    name: string;
    args: {
        [key: string]: any;
    };
    description: string;
}
interface ReviewConfig {
    action_name: string;
    allowed_decisions: ('approve' | 'edit' | 'reject')[];
}
interface InterruptValue {
    action_requests: ActionRequest[];
    review_configs: ReviewConfig[];
}
export interface Interrupt {
    value: InterruptValue;
    id: string;
}
export interface Decisions {
    [key: string]: DecisionObject;
}
export interface DecisionObject {
    decisions: DecisionItem[];
}
export interface DecisionItem {
    type: DecisionType;
    [key: string]: any;
}
export declare enum DecisionType {
    APPROVE = "approve",
    EDIT = "edit",
    REJECT = "reject"
}
export interface Config {
    debug: boolean;
    autoExecute: boolean;
    context?: string;
    namespace?: string;
    version: string;
    query?: string;
    interactive?: boolean;
}
export interface AppContainerProps {
    config: Config;
}
export interface LangGraphMessage {
    type: string;
    content: string | any;
    id?: string;
    tool_call_id?: string;
    kwargs?: {
        content?: string;
        tool_calls?: any[];
        tool_call_id?: string;
    };
    tool_calls?: any[];
}
export interface LangGraphChunk {
    [nodeName: string]: {
        messages: LangGraphMessage[];
    };
}
export {};
