// 定义 role enum
export enum CustomMultiMessageRole {
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant",
}

export interface Message {
  // role 可选值 system | user | assistant
  // system: 标识这条消息是 系统消息
  // user: 标识这条消息是 用户的问题
  // assistant:  标识这条消息是 助手的回答
  role:
    | CustomMultiMessageRole.SYSTEM
    | CustomMultiMessageRole.USER
    | CustomMultiMessageRole.ASSISTANT;
  // content 数组的类型可能是 string | AssistantMessage[]
  // 当 role == "user" 或 "system" 时，content 是 string
  // 当 role == "assistant" 时，content 是 AssistantMessage[]
  content: string | AssistantMessage[];
  timestamp: Date;
  streaming?: boolean;
  error?: boolean;
}

// type enum 定义
export enum AssistantMessageType {
  TOOL_CALL = "tool_call",
  TEXT = "text",
}

// 当 CustomMultiMessage.role == "assistant" 时，content 的类型定义
export interface AssistantMessage {
  // type 可选值 tool_call | text
  // tool_call: 表示工具调取请求 和 结果
  // text: 大模型输出
  type: AssistantMessageType.TOOL_CALL | AssistantMessageType.TEXT;
  // 当 type == "tool_call" 时，工具调用的请求存储在 tool_calls 中，为什么要调用工具存储在 content 中
  tool_calls?: ToolCall[];
  content?: string;
}

export enum ToolCallStatus {
  PENDING = "pending",
  EXECUTING = "executing",
  SUCCESS = "success",
  ERROR = "error",
  CANCELED = "canceled",
}

// 工具请求和结果的类型定义
export interface ToolCall {
  name: string;
  args: {
    // 允许其他属性
    [key: string]: any;
  };
  id?: string;
  type?: string;
  interrupt?: Interrupt;
  decisions?: Decisions;
  result?: string;
  status?: ToolCallStatus;
}

// 接口中 Interrupt 定义
interface ActionRequest {
  name: string;
  args: {
    [key: string]: any;
  };
  description: string;
}

interface ReviewConfig {
  action_name: string;
  allowed_decisions: ("approve" | "edit" | "reject")[];
}

interface InterruptValue {
  action_requests: ActionRequest[];
  review_configs: ReviewConfig[];
}

export interface Interrupt {
  value: InterruptValue;
  id: string;
}

// 决策映射类型定义
export interface Decisions {
  [key: string]: DecisionObject;
}

// 单个决策对象定义
export interface DecisionObject {
  decisions: DecisionItem[];
}

// 决策项类型定义
export interface DecisionItem {
  type: DecisionType;

  // 可能还有其他字段，如备注、时间等
  [key: string]: any;
}

export enum DecisionType {
  APPROVE = "approve",
  EDIT = "edit",
  REJECT = "reject",
}

export interface Config {
  debug: boolean;
  autoExecute: boolean;
  context?: string;
  namespace?: string;
  version: string;
  query?: string;
  interactive?: boolean;
  lang: "zh-CN" | "en-US";
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
