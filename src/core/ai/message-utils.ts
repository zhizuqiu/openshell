import type { BaseMessage } from "@langchain/core/messages";
import type { Message, AssistantMessage, ToolCall } from "../../ui/types.js";
import {
  CustomMultiMessageRole as Role,
  AssistantMessageType as MsgType,
  ToolCallStatus,
} from "../../ui/types.js";
import { t } from "../../i18n.js";

interface ProcessedMessage {
  role: Role;
  content: string | AssistantMessage[];
  timestamp: Date;
}

interface ToolResult {
  result: string;
  status: ToolCallStatus;
}

export function parseToolResults(
  langChainMessages: BaseMessage[],
): Map<string, ToolResult> {
  const toolResults = new Map<string, ToolResult>();

  for (const m of langChainMessages) {
    const kwargs = (m as any).kwargs || m;
    const type =
      (m as any).type ||
      kwargs.type ||
      (typeof (m as any)._getType === "function"
        ? (m as any)._getType()
        : kwargs._getType?.());

    const isTool =
      type === "tool" ||
      (m as any).id?.[2] === "ToolMessage" ||
      kwargs.id?.[2] === "ToolMessage";

    if (isTool) {
      const toolCallId = (m as any).tool_call_id || kwargs.tool_call_id;
      const resultContent = (m as any).content ?? kwargs.content ?? "";

      let resultStr = String(resultContent);
      let status = ToolCallStatus.SUCCESS;

      try {
        const parsed = JSON.parse(resultContent);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.output === "string") {
            resultStr = parsed.output;
          } else if (typeof parsed.result === "string") {
            resultStr = parsed.result;
          }
          if (parsed.status === "error" || parsed.status === "failed") {
            status = ToolCallStatus.ERROR;
          } else if (
            parsed.status === "canceled" ||
            parsed.status === "cancelled"
          ) {
            status = ToolCallStatus.CANCELED;
          }
        }
      } catch {
        const isRejected =
          resultContent.includes("rejected") ||
          resultContent.includes("cancelled") ||
          resultContent.includes("拒绝") ||
          resultContent.includes("取消");
        if (isRejected) {
          status = ToolCallStatus.CANCELED;
          resultStr =
            t("hitl.rejectedFeedback") || "Operation rejected by user.";
        }
      }

      if (resultStr.includes("Error") || resultStr.includes("failed")) {
        status = ToolCallStatus.ERROR;
      }

      if (toolCallId) {
        toolResults.set(toolCallId, { result: resultStr, status });
      }
    }
  }

  return toolResults;
}

export function convertLangChainMessage(
  m: BaseMessage,
  toolResults: Map<string, ToolResult>,
): ProcessedMessage | null {
  const kwargs = (m as any).kwargs || m;
  const type =
    (m as any).type ||
    kwargs.type ||
    (typeof (m as any)._getType === "function"
      ? (m as any)._getType()
      : kwargs._getType?.());

  const isTool =
    type === "tool" ||
    (m as any).id?.[2] === "ToolMessage" ||
    kwargs.id?.[2] === "ToolMessage";

  if (isTool) return null;

  let role: Role = Role.ASSISTANT;
  if (
    type === "human" ||
    type === "user" ||
    ((m as any).id &&
      Array.isArray((m as any).id) &&
      (m as any).id[2] === "HumanMessage")
  ) {
    role = Role.USER;
  } else if (
    type === "system" ||
    ((m as any).id &&
      Array.isArray((m as any).id) &&
      (m as any).id[2] === "SystemMessage")
  ) {
    role = Role.SYSTEM;
  } else if (
    type === "ai" ||
    ((m as any).id &&
      Array.isArray((m as any).id) &&
      ((m as any).id[2] === "AIMessage" ||
        (m as any).id[2] === "AIMessageChunk"))
  ) {
    role = Role.ASSISTANT;
  }

  let content: string | AssistantMessage[] =
    (m as any).content ?? kwargs.content;
  const timestamp =
    (m as any).additional_kwargs?.timestamp ||
    kwargs.additional_kwargs?.timestamp ||
    Date.now();

  if (role === Role.ASSISTANT) {
    const assistantContent: AssistantMessage[] = [];

    const toolCalls =
      (m as any).tool_calls ||
      kwargs.tool_calls ||
      (m as any).kwargs?.tool_calls ||
      (m as any).kwargs?.kwargs?.tool_calls ||
      [];

    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const formattedToolCalls: ToolCall[] = toolCalls.map((tc: any) => {
        const tcId = tc.id || "";
        const toolResult = toolResults.get(tcId);
        return {
          id: tcId,
          name: tc.name || "unknown",
          args: tc.args || {},
          result: toolResult !== undefined ? toolResult.result : tc.result,
          status:
            toolResult !== undefined
              ? toolResult.status
              : tc.status || ToolCallStatus.SUCCESS,
        };
      });
      assistantContent.push({
        type: MsgType.TOOL_CALL,
        tool_calls: formattedToolCalls,
      });
    }

    if (typeof content === "string" && content.trim()) {
      if (content.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && parsed[0]?.type) {
              assistantContent.push(...(parsed as AssistantMessage[]));
            } else {
              const hasToolCalls = parsed.some(
                (item) => item.name || item.function || item.id,
              );
              if (hasToolCalls) {
                const formattedOldFormat: ToolCall[] = parsed.map(
                  (tc: any) => ({
                    id: tc.id || tc.function?.id || "",
                    name: tc.name || tc.function?.name || "unknown",
                    args: tc.args || tc.function?.arguments || {},
                    result: tc.result,
                    status: tc.status || ToolCallStatus.SUCCESS,
                  }),
                );
                assistantContent.push({
                  type: MsgType.TOOL_CALL,
                  tool_calls: formattedOldFormat,
                });
              } else {
                assistantContent.push({ type: MsgType.TEXT, content });
              }
            }
          } else {
            assistantContent.push({ type: MsgType.TEXT, content });
          }
        } catch {
          assistantContent.push({ type: MsgType.TEXT, content });
        }
      } else {
        assistantContent.push({ type: MsgType.TEXT, content });
      }
    } else if (content && !Array.isArray(content)) {
      assistantContent.push({
        type: MsgType.TEXT,
        content: String(content || ""),
      });
    }

    if (assistantContent.length === 0) {
      assistantContent.push({ type: MsgType.TEXT, content: "" });
    }

    content = assistantContent;
  }

  return {
    role,
    content,
    timestamp: new Date(timestamp),
  };
}

export function formatSessionMessages(
  processedMessages: ProcessedMessage[],
): Message[] {
  return processedMessages
    .filter(
      (m) =>
        m.content &&
        (typeof m.content === "string" ||
          (Array.isArray(m.content) && m.content.length > 0)),
    )
    .map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));
}
