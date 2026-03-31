import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { renderMarkdown } from "./markdown.js";
import type { Message, AssistantMessage, ToolCall } from "./types.js";
import {
  CustomMultiMessageRole as Role,
  AssistantMessageType as MsgType,
  ToolCallStatus,
} from "./types.js";
import { getThemeColors } from "./themes/index.js";

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

function truncateArgs(args: ToolCall["args"]) {
  const argsString = JSON.stringify(args);
  return argsString.length > 120 ? `${argsString.slice(0, 117)}...` : argsString;
}

// 渲染单个工具调用请求和结果
function renderToolCallItem(
  toolCall: ToolCall,
  index: number,
  _isStreaming?: boolean,
) {
  const { name, args, result, id, interrupt, status } = toolCall;
  const displayArgs = truncateArgs(args);

  let statusIcon = <Text dimColor>●</Text>;
  let statusLabel: string | null = null;
  const isCancelled = status === ToolCallStatus.CANCELED;
  const isError = status === ToolCallStatus.ERROR;

  switch (status) {
    case ToolCallStatus.EXECUTING:
      statusIcon = (
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
      );
      statusLabel = "running";
      break;
    case ToolCallStatus.SUCCESS:
      statusIcon = <Text dimColor>●</Text>;
      break;
    case ToolCallStatus.ERROR:
      statusIcon = <Text color="red">●</Text>;
      statusLabel = "failed";
      break;
    case ToolCallStatus.CANCELED:
      statusIcon = <Text dimColor>●</Text>;
      statusLabel = "canceled";
      break;
    case ToolCallStatus.PENDING:
      statusIcon = <Text dimColor>●</Text>;
      statusLabel = "queued";
      break;
  }

  if (interrupt) {
    statusLabel = "waiting for permission";
  }

  return (
    <Box flexDirection="column" key={id || `tool-item-${index}`} marginBottom={1}>
      <Box flexDirection="row" flexWrap="wrap">
        <Box marginRight={1}>{statusIcon}</Box>
        <Box flexDirection="row" flexWrap="wrap">
          <Text bold strikethrough={isCancelled} color={isError ? "red" : undefined}>
            {name}
          </Text>
          <Text dimColor strikethrough={isCancelled}>
            ({displayArgs})
          </Text>
          {statusLabel ? <Text dimColor>{` ${statusLabel}`}</Text> : null}
        </Box>
      </Box>

      {interrupt && (
        <Box flexDirection="column" marginLeft={2}>
          <Text dimColor>
            {interrupt.value?.action_requests?.[0]?.description ||
              "Please review and decide in the input area."}
          </Text>
        </Box>
      )}

      {result && !isCancelled && (
        <Box flexDirection="row" marginLeft={2}>
          <Text dimColor color={isError ? "red" : undefined}>
            ⎿{" "}
          </Text>
          <Text dimColor={!isError} color={isError ? "red" : undefined} wrap="wrap">
            {truncateResult(result)}
          </Text>
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
          <Text color={isError ? "red" : "cyan"}>✨</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Text>{renderMarkdown(block.content || "")}</Text>
        </Box>
      </Box>
    );
  } else if (block.type === MsgType.TOOL_CALL) {
    return (
      <Box flexDirection="column" key={`tool-block-${index}`}>
        {block.tool_calls?.map((tc, tcIdx) =>
          renderToolCallItem(tc, tcIdx, isStreaming),
        )}
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
  const colors = getThemeColors();

  return (
    <Box flexDirection="column">
      {role === Role.USER ? (
        <Box
          flexDirection="column"
          marginBottom={1}
          backgroundColor={colors.userMessageBackground}
          paddingRight={1}
        >
          <Text wrap="wrap">
            <Text dimColor>❯ </Text>
            <Text>{content as string}</Text>
          </Text>
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
                <Text color={error ? "red" : "cyan"}>✨</Text>
              </Box>
              <Box flexDirection="column" flexGrow={1}>
                <Text>{renderMarkdown(content as string)}</Text>
              </Box>
            </Box>
          )}
          {streaming && (!Array.isArray(content) || content.length === 0) && (
            <Box flexDirection="row" marginBottom={1}>
              <Box marginRight={1}>
                <Text color="cyan">✨</Text>
              </Box>
              <Text color="yellow">
                <Spinner type="dots" />
              </Text>
            </Box>
          )}
        </Box>
      ) : (
        renderSystemMessage(message)
      )}
    </Box>
  );
}
