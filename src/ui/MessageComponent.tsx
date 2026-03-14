import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { renderMarkdown } from "./markdown.js";
import type { Message, AssistantMessage, ToolCall } from "./types.js";
import {
  CustomMultiMessageRole as Role,
  AssistantMessageType as MsgType,
  ToolCallStatus,
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
function renderToolCallItem(toolCall: ToolCall, index: number, isStreaming?: boolean) {
  const { name, args, result, id, interrupt, status } = toolCall;
  const argsString = JSON.stringify(args);
  const displayArgs =
    argsString.length > 100 ? argsString.substring(0, 100) + "..." : argsString;

  const termWidth = process.stdout.columns || 80;
  const safeWidth = termWidth - 6;

  let statusIcon = <Text color="blue">●</Text>;
  let borderColor = "white"; // 默认浅灰色
  let isCancelled = status === ToolCallStatus.CANCELED;
  let isError = status === ToolCallStatus.ERROR;

  // 根据枚举状态设置 UI
  switch (status) {
    case ToolCallStatus.EXECUTING:
      statusIcon = (
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
      );
      borderColor = "cyan";
      break;
    case ToolCallStatus.SUCCESS:
      statusIcon = <Text color="green">✓</Text>;
      borderColor = "white"; // 浅灰色边框
      break;
    case ToolCallStatus.ERROR:
      statusIcon = <Text color="red">✗</Text>;
      borderColor = "red";
      break;
    case ToolCallStatus.CANCELED:
      statusIcon = <Text color="gray">⊘</Text>;
      borderColor = "white";
      break;
    case ToolCallStatus.PENDING:
      statusIcon = <Text color="yellow">⏸</Text>;
      borderColor = "yellow";
      break;
  }

  // 补丁：处理旧数据或通过 interrupt 识别 PENDING
  if (interrupt) {
    statusIcon = <Text color="yellow">⏸</Text>;
    borderColor = "yellow";
  }

  return (
    <Box
      flexDirection="column"
      key={id || `tool-item-${index}`}
      marginBottom={1}
      borderStyle="round"
      borderColor={borderColor}
      borderDimColor={true}
      paddingX={1}
      width={safeWidth}
    >
      {/* Header & Tool Name */}
      <Box flexDirection="row" marginBottom={0}>
        <Box marginRight={1}>{statusIcon}</Box>
        <Text bold strikethrough={isCancelled} color={isError ? "red" : undefined}>
          {name}
        </Text>
        {status === ToolCallStatus.EXECUTING && (
          <Text dimColor italic> (running...)</Text>
        )}
      </Box>

      {/* Arguments */}
      <Box marginLeft={3} flexDirection="column">
        <Text dimColor wrap="wrap" strikethrough={isCancelled}>
          {displayArgs}
        </Text>
      </Box>

      {/* HITL 决策提示 */}
      {interrupt && (
        <Box
          flexDirection="column"
          marginLeft={3}
          marginTop={1}
        >
          <Text color="yellow" bold>
            ⚠ Action requires your approval
          </Text>
          <Text color="yellow" dimColor italic>
            {interrupt.value?.action_requests?.[0]?.description || "Please review and decide in the input area."}
          </Text>
        </Box>
      )}

      {/* 工具结果 */}
      {result && !isCancelled && (
        <Box flexDirection="column" marginLeft={3} marginTop={1}>
          <Box borderStyle="single" borderLeft={true} borderRight={false} borderTop={false} borderBottom={false} paddingLeft={1} borderColor="gray">
            <Text dimColor={!isError} color={isError ? "red" : undefined} wrap="wrap">
              {truncateResult(result)}
            </Text>
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
        {block.tool_calls?.map((tc, tcIdx) => renderToolCallItem(tc, tcIdx, isStreaming))}
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
        <Box 
          flexDirection="row" 
          marginBottom={1} 
          borderStyle="round" 
          borderColor="cyan" 
          borderDimColor={true}
          paddingX={1}
          width={(process.stdout.columns || 80) - 4}
        >
          <Box marginRight={1}>
            <Text color="cyan" dimColor>{`>`}</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <Text color="white" wrap="wrap" dimColor>{content as string}</Text>
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
