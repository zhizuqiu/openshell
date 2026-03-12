import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import { CustomMultiMessageRole as Role, AssistantMessageType as MsgType, } from './types.js';
// 辅助函数：根据规则截断工具结果
function truncateResult(result) {
    const lines = result.split('\n');
    const isLong = result.length > 500 || lines.length > 3;
    if (isLong) {
        let preview = lines.slice(0, 3).join('\n');
        if (preview.length > 500) {
            preview = preview.substring(0, 500);
        }
        return `${preview}\n...`;
    }
    return result;
}
// 渲染单个工具调用请求和结果
function renderToolCallItem(toolCall) {
    const { name, args, result, id, interrupt } = toolCall;
    const argsString = JSON.stringify(args);
    const displayArgs = argsString.length > 100 ? argsString.substring(0, 100) + '...' : argsString;
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { flexDirection: "row", marginBottom: 0, children: [_jsx(Box, { marginRight: 1, children: _jsx(Text, { color: "blue", children: "\u25CF" }) }), _jsx(Box, { flexDirection: "column", flexGrow: 1, children: _jsxs(Text, { color: "blue", children: [name, "(", displayArgs, ")"] }) })] }), interrupt && (_jsxs(Box, { flexDirection: "column", marginLeft: 2, marginTop: 0, marginBottom: 1, children: [_jsxs(Text, { color: "yellow", bold: true, children: ["Review Required:", ' ', interrupt.value?.action_requests?.[0]?.description ||
                                'Action requires approval'] }), _jsxs(Text, { color: "yellow", dimColor: true, children: [' ', "(Pending review in input area below)", ' '] })] })), result && (_jsx(Box, { flexDirection: "column", marginLeft: 2, children: _jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { color: "gray", children: " \u23BF " }), _jsx(Box, { flexDirection: "column", paddingRight: 2, children: _jsx(Text, { dimColor: true, children: truncateResult(result) }) })] }) }))] }, id || name));
}
// 渲染系统消息
function renderSystemMessage(message) {
    return (_jsx(Box, { marginY: 0, marginBottom: 1, children: _jsxs(Text, { dimColor: true, children: ["[System] ", message.content] }) }));
}
// 渲染助手消息中的某个块（文本或工具调用组）
function renderAssistantContentBlock(block, index, isError, isStreaming) {
    if (block.type === MsgType.TEXT) {
        return (_jsxs(Box, { flexDirection: "row", marginBottom: 1, children: [_jsx(Box, { marginRight: 1, children: _jsx(Text, { color: isError ? 'red' : 'white', children: "\u25CF" }) }), _jsx(Box, { flexDirection: "column", flexGrow: 1, children: _jsx(Text, { color: isError ? 'red' : 'white', children: block.content }) })] }, `text-${index}`));
    }
    else if (block.type === MsgType.TOOL_CALL) {
        return (_jsx(Box, { flexDirection: "column", children: block.tool_calls?.map((tc) => renderToolCallItem(tc)) }, `tool-${index}`));
    }
    return null;
}
export function MessageComponent({ message }) {
    const { role, content, error, streaming } = message;
    return (_jsx(Box, { flexDirection: "column", children: role === Role.USER ? (_jsxs(Box, { flexDirection: "row", marginBottom: 1, children: [_jsx(Box, { marginRight: 1, children: _jsx(Text, { bold: true, color: "white", children: `>` }) }), _jsx(Box, { flexDirection: "column", flexGrow: 1, children: _jsx(Text, { color: "white", children: content }) })] })) : role === Role.ASSISTANT ? (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [Array.isArray(content) ? (content.map((block, idx) => renderAssistantContentBlock(block, idx, error, streaming))) : (_jsxs(Box, { flexDirection: "row", marginBottom: 1, children: [_jsx(Box, { marginRight: 1, children: _jsx(Text, { color: error ? 'red' : 'white', children: "\u25CF" }) }), _jsx(Box, { flexDirection: "column", flexGrow: 1, children: _jsx(Text, { color: error ? 'red' : 'white', children: content }) })] })), streaming && (!Array.isArray(content) || content.length === 0) && (_jsxs(Box, { flexDirection: "row", marginBottom: 1, children: [_jsx(Box, { marginRight: 1, children: _jsx(Text, { color: "white", children: "\u25CF" }) }), _jsx(Text, { color: "yellow", children: "..." })] }))] })) : (renderSystemMessage(message)) }));
}
//# sourceMappingURL=MessageComponent.js.map