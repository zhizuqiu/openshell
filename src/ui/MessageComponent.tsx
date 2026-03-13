import { Box, Text } from "ink";
import { renderMarkdown } from "./markdown.js";
import type { Message, AssistantMessage, ToolCall } from "./types.js";
import {
  CustomMultiMessageRole as Role,
  AssistantMessageType as MsgType,
} from "./types.js";

// 辅助函数：根据规则截断工具结果
function truncateResult(result: string) {
  const lines = result.split("\n");
  const isLong = result.length > 500 || lines.length > 3;

  if (isLong) {
    let preview = lines.slice(0, 3).join("\n");
    if (preview.length > 500) {
      preview = preview.substring(0, 500);
    }
    return `${preview}\n...`;
  }
  return result;
}

// 渲染单个工具调用请求和结果
function renderToolCallItem(toolCall: ToolCall) {
  const { name, args, result, id, interrupt } = toolCall;
  const argsString = JSON.stringify(args);
  const displayArgs =
    argsString.length > 100 ? argsString.substring(0, 100) + "..." : argsString;

  return (
    <Box flexDirection="column" key={id || name} marginBottom={1}>
      {/* 工具请求 */}
      <Box flexDirection="row" marginBottom={0}>
        <Box marginRight={1}>
          <Text color="blue">●</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Text color="blue">
            {name}({displayArgs})
          </Text>
        </Box>
      </Box>

      {/* HITL 决策提示 (仅展示状态) */}
      {interrupt && (
        <Box
          flexDirection="column"
          marginLeft={2}
          marginTop={0}
          marginBottom={1}
        >
          <Text color="yellow" bold>
            Review Required:{" "}
            {interrupt.value?.action_requests?.[0]?.description ||
              "Action requires approval"}
          </Text>
          <Text color="yellow" dimColor>
            {" "}
            (Pending review in input area below){" "}
          </Text>
        </Box>
      )}

      {/* 工具结果 */}
      {result && (
        <Box flexDirection="column" marginLeft={2}>
          <Box flexDirection="row">
            <Text color="gray"> ⎿ </Text>
            <Box flexDirection="column" paddingRight={2}>
              <Text dimColor>{truncateResult(result)}</Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// 渲染系统消息
function renderSystemMessage(message: Message) {
  return (
    <Box marginY={0} marginBottom={1}>
      <Text dimColor>[System] {message.content as string}</Text>
    </Box>
  );
}

// 渲染助手消息中的某个块（文本或工具调用组）
function renderAssistantContentBlock(
  block: AssistantMessage,
  index: number,
  isError?: boolean,
  isStreaming?: boolean,
) {
  if (block.type === MsgType.TEXT) {
    return (
      <Box flexDirection="row" marginBottom={1} key={`text-${index}`}>
        <Box marginRight={1}>
          <Text color={isError ? "red" : "white"}>●</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Text>{renderMarkdown(block.content || "")}</Text>
        </Box>
      </Box>
    );
  } else if (block.type === MsgType.TOOL_CALL) {
    return (
      <Box flexDirection="column" key={`tool-${index}`}>
        {block.tool_calls?.map((tc) => renderToolCallItem(tc))}
      </Box>
    );
  }
  return null;
}

interface MessageComponentProps {
  message: Message;
}

export function MessageComponent({ message }: MessageComponentProps) {
  const { role, content, error, streaming } = message;

  return (
    <Box flexDirection="column">
      {role === Role.USER ? (
        <Box flexDirection="row" marginBottom={1}>
          <Box marginRight={1}>
            <Text bold color="white">{`>`}</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <Text color="white">{content as string}</Text>
          </Box>
        </Box>
      ) : role === Role.ASSISTANT ? (
        <Box flexDirection="column" marginBottom={1}>
          {/* 按顺序渲染助手的内容块 */}
          {Array.isArray(content) ? (
            content.map((block, idx) =>
              renderAssistantContentBlock(block, idx, error, streaming),
            )
          ) : (
            <Box flexDirection="row" marginBottom={1}>
              <Box marginRight={1}>
                <Text color={error ? "red" : "white"}>●</Text>
              </Box>
              <Box flexDirection="column" flexGrow={1}>
                <Text>{renderMarkdown(content as string)}</Text>
              </Box>
            </Box>
          )}
          {streaming && (!Array.isArray(content) || content.length === 0) && (
            <Box flexDirection="row" marginBottom={1}>
              <Box marginRight={1}>
                <Text color="white">●</Text>
              </Box>
              <Text color="yellow">...</Text>
            </Box>
          )}
        </Box>
      ) : (
        renderSystemMessage(message)
      )}
    </Box>
  );
}
