import { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useStdin, Static } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import { createDataListener } from './input/key-parser.js';
import type { Key } from './input/key-parser.js';
import { createShellAgent } from '../core/index.js';
import { t } from '../i18n.js';
import { MessageComponent } from './MessageComponent.js';
import type {
    AppContainerProps,
    Message,
    AssistantMessage,
    Interrupt,
} from './types.js';
import {
    CustomMultiMessageRole as Role,
    AssistantMessageType as MsgType,
} from './types.js';
import { Command } from '@langchain/langgraph';
import type { ReactAgent } from 'langchain';
import { BaseMessage, AIMessage, ToolMessage } from '@langchain/core/messages';



function Separator() {
    return (
        <Box
            borderStyle="single"
            borderTop={true}
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            height={1}
        />
    );
}

export function AppContainer({ config }: AppContainerProps) {
    // --- 状态与引用 (State & Refs) ---
    // 包含 UI 状态、消息历史、输入值以及用于同步操作的 Refs
    const [isLoading, setIsLoading] = useState(true); // 是否正在初始化 Agent 和 Kubernetes 客户端
    const [messages, setMessages] = useState<Message[]>([]); // 聊天消息历史，包含用户输入、AI 响应和工具调用结果
    const [inputValue, setInputValue] = useState(''); // 当前输入框的文本内容（用于渲染）
    const [cursorPosition, setCursorPosition] = useState(0); // 当前光标在输入框中的位置
    const [isProcessing, setIsProcessing] = useState(false); // 是否正在处理 AI 流，用于锁定输入和显示加载状态
    const [agent, setAgent] = useState<ReactAgent | null>(null); // LangChain Agent 实例

    const [autoExecute, setAutoExecute] = useState(false); // 自主执行模式开关，开启后将跳过 HITL 审批
    const queryExecutedRef = useRef(false); // 确保在初始启动时的 query 指令只执行一次
    const activeStreamsRef = useRef(0); // 追踪当前活跃的流数量，防止并发冲突
    const isResumeRef = useRef(false); // 标记当前流是否为 HITL 审批后的恢复执行
    const currentAiMsgIndexRef = useRef<number>(-1); // 当前正在执行流式更新的 AI 消息在数组中的索引
    const messagesRef = useRef(messages); // 消息数组的引用，用于在非 React 闭包（如 stdin 事件）中获取最新状态
    const isProcessingRef = useRef(isProcessing); // 处理状态的引用，用于输入拦截逻辑
    const seenMessageIdsRef = useRef(new Set<string>()); // 已渲染的消息 ID 集合，用于多轮对话的消息去重
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const suggestionsRef = useRef<string[]>([]);
    const selectedIndexRef = useRef(0);

    const ALL_COMMANDS = ['help', 'version', 'exit'];

    useEffect(() => {
        if (inputValue.startsWith('/')) {
            const query = inputValue.slice(1).toLowerCase();
            const filtered = ALL_COMMANDS.filter((cmd) => cmd.startsWith(query));
            setSuggestions(filtered);
            suggestionsRef.current = filtered;
            setSelectedIndex(0);
            selectedIndexRef.current = 0;
        } else {
            setSuggestions([]);
            suggestionsRef.current = [];
        }
    }, [inputValue]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        isProcessingRef.current = isProcessing;
    }, [isProcessing]);

    const { exit } = useApp();
    const { stdin, setRawMode } = useStdin();

    const inputValueRef = useRef(inputValue);
    const cursorRef = useRef(cursorPosition);

    const commandHistoryRef = useRef<string[]>([]);
    const historyIndexRef = useRef<number>(-1);
    const draftInputRef = useRef<string>('');

    // --- 辅助函数 ---
    // 检查消息是否包含待处理的中断 (HITL 流程)
    const messageHasInterrupt = (m: Message) => {
        return (
            m.role === Role.ASSISTANT &&
            Array.isArray(m.content) &&
            m.content.some(
                (block) =>
                    block.type === MsgType.TOOL_CALL &&
                    block.tool_calls?.some((tc) => tc.interrupt),
            )
        );
    };

    // --- Agent 初始化 ---
    // 根据环境变量创建 AI Agent 实例
    useEffect(() => {
        const initializeAgent = async () => {
            try {
                const apiKey = process.env['OPENAI_API_KEY'];
                const baseURL = process.env['OPENAI_BASE_URL'];
                const model = process.env['OPENAI_API_MODEL'] || 'gpt-3.5-turbo';

                if (!apiKey || !baseURL) {
                    setMessages([
                        {
                            role: Role.SYSTEM,
                            content: t('app.welcome'),
                            timestamp: new Date(),
                        },
                        {
                            role: Role.SYSTEM,
                            content: t('app.aiNotConfigured'),
                            timestamp: new Date(),
                        },
                    ]);
                    setIsLoading(false);
                    return;
                }

                const agentConfig = {
                    apiKey,
                    baseURL,
                    model,
                };
                const shellAgent = await createShellAgent(agentConfig);
                setAgent(shellAgent);
            } catch (error) {
                handleError(error);
            } finally {
                setIsLoading(false);
            }
        };
        initializeAgent();
    }, []);

    // --- 指令与流处理入口 ---
    // 处理用户提交的指令并启动 AI 流响应
    const handleCommand = async (
        command: string,
        isFromQuery: boolean = false,
    ) => {
        const trimmed = command.trim();
        if (!isFromQuery) {
            commandHistoryRef.current.push(trimmed);
            historyIndexRef.current = -1;
            setMessages((prev) => [
                ...prev,
                { role: Role.USER, content: trimmed, timestamp: new Date() },
            ]);
        }

        // 处理本地专用斜杠命令
        if (trimmed.startsWith('/')) {
            const cmd = trimmed.slice(1).toLowerCase().split(' ')[0];
            if (cmd === 'clear') {
                setMessages([]);
                seenMessageIdsRef.current.clear();
                return;
            }
            if (cmd === 'exit') {
                exit();
                setTimeout(() => process.exit(0), 100);
                return;
            }
            if (cmd === 'version') {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: Role.ASSISTANT,
                        content: `OpenShell ${config.version}`,
                        timestamp: new Date(),
                    },
                ]);
                return;
            }
            if (cmd === 'help') {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: Role.ASSISTANT,
                        content: `${t('help.availableCommands')}
  /help    - ${t('help.helpCommand')}
  /version - ${t('help.versionCommand')}
  /clear   - ${t('help.clearCommand')}
  /exit    - ${t('help.exitCommand')}
  
${t('help.withAiAgent')}`,
                        timestamp: new Date(),
                    },
                ]);
                return;
            }
        }

        if (agent) {
            // Check for pending interrupts (HITL)
            const currentMessages = messagesRef.current;
            const pendingMsg = currentMessages.find(messageHasInterrupt);

            // If there's a pending interrupt and the input is empty or "继续/continue/ok"
            // we resume the graph with approval.
            const resumeKeywords = ['继续', 'continue', 'ok', 'yes', 'y', '']
            if (pendingMsg && resumeKeywords.includes(trimmed.toLowerCase())) {
                const block = (pendingMsg.content as AssistantMessage[]).find(
                    (b) => b.type === MsgType.TOOL_CALL && b.tool_calls?.some((tc) => tc.interrupt),
                );
                const tc = block?.tool_calls?.find((t) => t.interrupt);
                if (tc && tc.interrupt) {
                    await handleDecision('approve', tc.id || '', tc.interrupt);
                    return;
                }
            }

            await handleAiStream(trimmed);
        } else {
            setMessages((prev) => [
                ...prev,
                {
                    role: Role.ASSISTANT,
                    content: 'Agent not ready.',
                    timestamp: new Date(),
                },
            ]);
            setIsProcessing(false);
        }
    };

    const handleAiStream = async (cmd: string) => {
        activeStreamsRef.current++;
        setIsProcessing(true);
        try {
            setMessages((prev) => {
                const next = [
                    ...prev,
                    {
                        role: Role.ASSISTANT,
                        content: [],
                        timestamp: new Date(),
                        streaming: true,
                    },
                ];
                currentAiMsgIndexRef.current = next.length - 1;
                return next;
            });
            if (!agent) return;
            const stream = await agent.stream(
                { messages: [{ role: Role.USER, content: cmd }] },
                { streamMode: 'updates', configurable: { thread_id: 'main-session' } },
            );
            await processAiStream(stream);
        } catch (error) {
            handleError(error);
        } finally {
            activeStreamsRef.current--;
            if (activeStreamsRef.current <= 0) setIsProcessing(false);
        }
    };

    // --- AI 流状态处理核心逻辑 ---
    // 负责解析 LangGraph 的 'updates' 流，并处理消息去重、工具调用渲染以及中断检测
    const processAiStream = async (
        stream: AsyncIterable<Record<string, any>>,
    ) => {
        let lastToolCallId: string | null = null;
        let hasInterrupt = false;
        const aiMsgIndex = currentAiMsgIndexRef.current;

        for await (const chunk of stream) {
            if (!chunk || typeof chunk !== 'object') continue;

            const nodeName = Object.keys(chunk)[0];
            const nodeData = chunk[nodeName] as { messages: BaseMessage[] };

            // 消息去重辅助逻辑：
            // 在 'updates' 模式下，middleware 处理后的消息会以序列化格式回传。
            // 此时 msg.id 可能是类路径数组 (如 ["langchain_core", "messages", "HumanMessage"])。
            // 我们必须提取真正的唯一 ID (通常在 kwargs.id 中) 进行字符串匹配。
            if (nodeData && Array.isArray(nodeData.messages)) {
                nodeData.messages = nodeData.messages.filter((msg: any) => {
                    const rawId = msg.id || (msg as any).kwargs?.id;
                    const msgId =
                        typeof rawId === 'string' ? rawId : (msg as any).kwargs?.id;

                    if (
                        typeof msgId === 'string' &&
                        seenMessageIdsRef.current.has(msgId)
                    ) {
                        return false;
                    }
                    if (typeof msgId === 'string') {
                        seenMessageIdsRef.current.add(msgId);
                    }
                    return true;
                });
            }

            const firstMsg = nodeData?.messages?.[0];
            const interrupt =
                chunk['__interrupt__']?.[0] ||
                (firstMsg instanceof AIMessage
                    ? (
                        firstMsg.additional_kwargs['interrupts'] as unknown as Interrupt[]
                    )?.[0]
                    : null) ||
                (firstMsg as any)?.interrupt;

            if (interrupt && !hasInterrupt) {
                hasInterrupt = true;
                if (autoExecute) {
                    handleDecision('approve', lastToolCallId || '', interrupt);
                    return;
                }

                setMessages((prev) => {
                    const next = [...prev];
                    const idx = aiMsgIndex;
                    if (idx === -1) return prev;
                    const aiMsg = { ...next[idx] };
                    const assistantContent = Array.isArray(aiMsg.content)
                        ? [...aiMsg.content]
                        : [];

                    // 更新消息树：找到当前正在运行的工具调用块，并注入中断（Interrupt）信息
                    // 这将触发 UI 显示审批按钮
                    for (const block of assistantContent) {
                        if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                            const tc = block.tool_calls.find(
                                (t) =>
                                    !t.result &&
                                    (lastToolCallId ? t.id === lastToolCallId : true),
                            );
                            if (tc) {
                                tc.interrupt = interrupt;
                                break;
                            }
                        }
                    }
                    aiMsg.content = assistantContent;
                    next[idx] = aiMsg;
                    return next;
                });
            }

            if (!nodeData || !Array.isArray(nodeData.messages)) continue;

            for (const msg of nodeData.messages as any[]) {
                const content =
                    typeof msg.content === 'string'
                        ? msg.content
                        : JSON.stringify(msg.content);
                const toolCalls = msg.tool_calls || msg.kwargs?.tool_calls || [];

                // 健壮的角色与类型识别
                let msgType = msg._getType?.() || msg.type || msg.kwargs?.type;
                if (!msgType && Array.isArray(msg.id)) {
                    const lcClass = msg.id[msg.id.length - 1];
                    if (lcClass === 'HumanMessage' || lcClass === 'HumanMessageChunk')
                        msgType = 'human';
                    else if (lcClass === 'AIMessage' || lcClass === 'AIMessageChunk')
                        msgType = 'ai';
                    else if (lcClass === 'ToolMessage') msgType = 'tool';
                    else if (lcClass === 'SystemMessage') msgType = 'system';
                }

                // 统一角色判定
                const isTool =
                    msgType === 'tool' ||
                    msg instanceof ToolMessage ||
                    msg.id === 'ToolMessage';
                const isAI =
                    msgType === 'ai' ||
                    msg instanceof AIMessage ||
                    msgType === 'assistant';
                const role = isTool ? 'tool' : isAI ? 'assistant' : msgType;

                // 严格过滤：仅处理当前 Turn 产生的 AI 响应或工具执行结果
                // 'human' 和 'system' 消息来自历史状态回传，应予跳过
                if (role === 'human' || role === 'system') continue;

                setMessages((prev) => {
                    const next = [...prev];
                    const idx = aiMsgIndex;
                    if (idx === -1) return prev;
                    const aiMsg = { ...next[idx] };
                    const assistantContent = Array.isArray(aiMsg.content)
                        ? [...aiMsg.content]
                        : [];

                    if (role === 'assistant') {
                        if (content) {
                            // 在 updates 模式下，系统返回的是该节点生成的完整文本。
                            // 为了支持流式视觉效果，我们检查最后一个文本块：
                            // 如果内容发生变化则同步替换，否则追加新块。
                            const lastTextBlock =
                                assistantContent[assistantContent.length - 1];
                            if (
                                lastTextBlock &&
                                lastTextBlock.type === MsgType.TEXT &&
                                lastTextBlock.content !== content
                            ) {
                                lastTextBlock.content = content;
                            } else if (
                                !lastTextBlock ||
                                lastTextBlock.type !== MsgType.TEXT
                            ) {
                                assistantContent.push({ type: MsgType.TEXT, content });
                            }
                        }
                        if (toolCalls && Array.isArray(toolCalls)) {
                            lastToolCallId = toolCalls[0]?.id || null;

                            // Check if this tool call block already exists in assistantContent to avoid duplicates
                            const exists = assistantContent.some(
                                (block) =>
                                    block.type === MsgType.TOOL_CALL &&
                                    block.tool_calls?.some(tc => tc.id === lastToolCallId)
                            );

                            if (!exists) {
                                assistantContent.push({
                                    type: MsgType.TOOL_CALL,
                                    tool_calls: toolCalls.map((tc) => ({
                                        id: tc.id || '',
                                        name: tc.name,
                                        args: tc.args,
                                    })),
                                });
                            }
                        }
                    } else if (role === 'tool') {
                        // 处理工具执行结果：将结果挂载到对应的工具调用块上，由 MessageComponent 负责渲染输出
                        const toolId =
                            msg instanceof ToolMessage ? msg.tool_call_id : msg.id;
                        for (const block of assistantContent) {
                            if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                                const tc = block.tool_calls.find((t) => t.id === toolId);
                                if (tc) tc.result = content;
                            }
                        }
                    }
                    aiMsg.content = assistantContent;
                    next[idx] = aiMsg;
                    return next;
                });
            }
        }
        setMessages((prev) => {
            const next = [...prev];
            const idx = aiMsgIndex;
            if (idx !== -1) next[idx].streaming = false;
            return next;
        });

        // 流处理结束后，获取当前线程的完整状态，确保所有消息 ID 都被记录到已读集合中。
        // 这是对循环内即时记录的补充，防止因 nodeData 结构差异导致的遗漏。
        try {
            if (agent) {
                const history = await agent.graph.getState({
                    configurable: { thread_id: 'main-session' },
                });
                if (history?.values?.messages) {
                    (history.values.messages as BaseMessage[]).forEach((msg) => {
                        const msgId = msg.id;
                        if (msgId) seenMessageIdsRef.current.add(msgId);
                    });
                }
            }
        } catch (e) {
            // 状态获取失败的降级处理
        }
    };

    // --- 人机交互 (HITL) 决策处理 ---
    // 处理用户对工具调用的“批准”或“拒绝”操作，并恢复流执行
    const handleDecision = async (
        decision: 'approve' | 'reject',
        toolId: string,
        interrupt?: Interrupt,
    ) => {
        if (!agent || !interrupt) return;
        activeStreamsRef.current++;
        setIsProcessing(true);
        isResumeRef.current = true;
        try {
            setMessages((prev) => {
                const next = [...prev];
                const aiIdx = [...next]
                    .reverse()
                    .findIndex((m) => m.role === Role.ASSISTANT);
                if (aiIdx !== -1) {
                    const idx = next.length - 1 - aiIdx;
                    next[idx] = { ...next[idx], streaming: true };
                    currentAiMsgIndexRef.current = idx;
                }

                for (const msg of next) {
                    if (msg.role === Role.ASSISTANT && Array.isArray(msg.content)) {
                        for (const block of msg.content) {
                            if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                                if (interrupt) {
                                    block.tool_calls.forEach((tc) => {
                                        if (tc.interrupt) delete tc.interrupt;
                                    });
                                } else {
                                    const tc = block.tool_calls.find((t) => t.id === toolId);
                                    if (tc) delete tc.interrupt;
                                }
                            }
                        }
                    }
                }
                return next;
            });

            let decisions: { type: string }[] = [{ type: decision }];
            if (interrupt?.value?.action_requests) {
                decisions = interrupt.value.action_requests.map(() => ({
                    type: decision,
                }));
            }

            const stream = await agent.stream(
                new Command({ resume: { [interrupt.id]: { decisions } } }) as any,
                { streamMode: 'updates', configurable: { thread_id: 'main-session' } },
            );
            await processAiStream(stream);
        } catch (error) {
            handleError(error);
        } finally {
            isResumeRef.current = false;
            activeStreamsRef.current--;
            if (activeStreamsRef.current <= 0) setIsProcessing(false);
        }
    };

    const handleError = (error: unknown) => {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setMessages((prev) => [
            ...prev,
            {
                role: Role.ASSISTANT,
                content: `System Error: ${errorMsg}`,
                timestamp: new Date(),
                error: true,
            },
        ]);
    };

    useEffect(() => {
        if (
            config.query &&
            !config.interactive &&
            agent &&
            !queryExecutedRef.current
        ) {
            queryExecutedRef.current = true;
            handleCommand(config.query, true);
        }
    }, [config.query, config.interactive, agent]);

    // --- 键盘输入处理 (低级事件监听) ---
    // 使用手动监听 stdin 的方式绕过 Ink 默认 input hook 在某些系统下的不稳定性
    // 支持：光标移动、退格删除、历史记录导航、Ctrl+C 退出、Ctrl+A 切换自主模式
    useEffect(() => {
        setRawMode(true);

        const handleKey = (key: Key) => {
            // Handle Exit - Always check this first
            if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
                exit();
                setTimeout(() => process.exit(0), 100);
                return;
            }

            // 特殊功能快捷键 (Ctrl+A)
            if (key.ctrl && key.name === 'a') {
                setAutoExecute((prev) => !prev);
                return;
            }

            const currentMessages = messagesRef.current;

            // 检查是否有挂起的中断 (HITL 模式)
            const hasInterrupt = currentMessages.some(messageHasInterrupt);

            // 状态锁机制：
            // 如果存在待处理的 HITL 中断或 AI 正在处理流，禁止普通文本输入，防止状态竞争
            if (hasInterrupt || isProcessing) return;

            const currentInputValue = inputValueRef.current;
            const currentCursorPosition = cursorRef.current;

            // Handle Return
            if (key.name === 'return' || key.name === 'enter') {
                if (suggestionsRef.current.length > 0) {
                    const picked = suggestionsRef.current[selectedIndexRef.current];
                    const fullCommand = '/' + picked;
                    handleCommand(fullCommand);
                    inputValueRef.current = '';
                    cursorRef.current = 0;
                    setInputValue('');
                    setCursorPosition(0);
                    setSuggestions([]);
                    suggestionsRef.current = [];
                    return;
                }
                if (currentInputValue.trim()) {
                    handleCommand(currentInputValue.trim());
                    inputValueRef.current = '';
                    cursorRef.current = 0;
                    setInputValue('');
                    setCursorPosition(0);
                }
                return;
            }

            // Handle Arrows
            if (key.name === 'left') {
                const nextPos = Math.max(0, currentCursorPosition - 1);
                cursorRef.current = nextPos;
                setCursorPosition(nextPos);
                return;
            }
            if (key.name === 'right') {
                const nextPos = Math.min(
                    currentInputValue.length,
                    currentCursorPosition + 1,
                );
                cursorRef.current = nextPos;
                setCursorPosition(nextPos);
                return;
            }
            if (key.name === 'up') {
                if (suggestionsRef.current.length > 0) {
                    const nextIndex =
                        (selectedIndexRef.current -
                            1 +
                            suggestionsRef.current.length) %
                        suggestionsRef.current.length;
                    selectedIndexRef.current = nextIndex;
                    setSelectedIndex(nextIndex);
                    return;
                }
                const history = commandHistoryRef.current;
                if (history.length === 0) return;

                if (historyIndexRef.current === -1) {
                    draftInputRef.current = currentInputValue;
                    historyIndexRef.current = history.length - 1;
                } else if (historyIndexRef.current > 0) {
                    historyIndexRef.current -= 1;
                } else {
                    return;
                }

                const historicalCommand = history[historyIndexRef.current];
                inputValueRef.current = historicalCommand;
                cursorRef.current = historicalCommand.length;
                setInputValue(historicalCommand);
                setCursorPosition(historicalCommand.length);
                return;
            }
            if (key.name === 'down') {
                if (suggestionsRef.current.length > 0) {
                    const nextIndex =
                        (selectedIndexRef.current + 1) %
                        suggestionsRef.current.length;
                    selectedIndexRef.current = nextIndex;
                    setSelectedIndex(nextIndex);
                    return;
                }
                const history = commandHistoryRef.current;
                if (historyIndexRef.current === -1) return;

                if (historyIndexRef.current < history.length - 1) {
                    historyIndexRef.current += 1;
                    const historicalCommand = history[historyIndexRef.current];
                    inputValueRef.current = historicalCommand;
                    cursorRef.current = historicalCommand.length;
                    setInputValue(historicalCommand);
                    setCursorPosition(historicalCommand.length);
                } else {
                    historyIndexRef.current = -1;
                    const draft = draftInputRef.current;
                    inputValueRef.current = draft;
                    cursorRef.current = draft.length;
                    setInputValue(draft);
                    setCursorPosition(draft.length);
                    draftInputRef.current = '';
                }
                return;
            }
            if (key.name === 'home') {
                cursorRef.current = 0;
                setCursorPosition(0);
                return;
            }
            if (key.name === 'end') {
                const nextPos = currentInputValue.length;
                cursorRef.current = nextPos;
                setCursorPosition(nextPos);
                return;
            }

            // Handle Backspace (Left Delete)
            if (key.name === 'backspace') {
                if (currentCursorPosition > 0) {
                    const newValue =
                        currentInputValue.slice(0, currentCursorPosition - 1) +
                        currentInputValue.slice(currentCursorPosition);
                    const nextPos = currentCursorPosition - 1;
                    inputValueRef.current = newValue;
                    cursorRef.current = nextPos;
                    setInputValue(newValue);
                    setCursorPosition(nextPos);
                }
                return;
            }

            // Handle Delete (Right Delete)
            if (key.name === 'delete') {
                if (currentCursorPosition < currentInputValue.length) {
                    const newValue =
                        currentInputValue.slice(0, currentCursorPosition) +
                        currentInputValue.slice(currentCursorPosition + 1);
                    inputValueRef.current = newValue;
                    setInputValue(newValue);
                }
                return;
            }

            // 处理打字输入：
            // 我们通过操作副本字符串并同步更新 Ref + State，确保在 Ink 异步渲染循环中输入不会丢失。
            const isPrintable = key.sequence && !key.ctrl && !key.meta;
            if (
                isPrintable &&
                (key.name === 'space' || !key.name || key.name.length === 1)
            ) {
                const char = key.name === 'space' ? ' ' : key.sequence;
                const newValue =
                    currentInputValue.slice(0, currentCursorPosition) +
                    char +
                    currentInputValue.slice(currentCursorPosition);
                const nextPos = currentCursorPosition + char.length;
                inputValueRef.current = newValue;
                cursorRef.current = nextPos;
                setInputValue(newValue);
                setCursorPosition(nextPos);
            }
        };

        const dataListener = createDataListener(handleKey);
        stdin.on('data', dataListener);

        return () => {
            stdin.off('data', dataListener);
        };
    }, [isProcessing, handleCommand, stdin, setRawMode, exit]);

    const stableMessages = messages.filter(
        (m) => !m.streaming && !messageHasInterrupt(m),
    );
    const activeMessages = messages.filter(
        (m) => m.streaming || messageHasInterrupt(m),
    );

    // 获取当前待处理的中断信息
    const pendingInterruptMessage = activeMessages.find(messageHasInterrupt);
    let pendingInterrupt: Interrupt | null = null;
    let pendingToolId: string = '';

    if (
        pendingInterruptMessage &&
        Array.isArray(pendingInterruptMessage.content)
    ) {
        const block = (pendingInterruptMessage.content as AssistantMessage[]).find(
            (b) =>
                b.type === MsgType.TOOL_CALL &&
                b.tool_calls?.some((tc) => tc.interrupt),
        );
        const tc = block?.tool_calls?.find((t) => t.interrupt);
        if (tc) {
            pendingInterrupt = tc.interrupt || null;
            pendingToolId = tc.id || '';
        }
    }

    // --- 渲染逻辑 ---
    // 基于消息状态分两部分渲染：Static 组件用于持久化历史，普通 Box 用于显示动态更新和交互输入
    return (
        <Box flexDirection="column" paddingX={1}>
            {/* Banner 必须作为渲染树中第一个 Static 元素，才能确保永久固定在终端最上方 */}
            <Static items={['banner']} key="brand-banner">
                {(item) => (
                    <Box key={item} marginBottom={1} flexDirection="column" alignItems="center" width="100%">
                        <Gradient name="morning">
                            <BigText text="OpenShell" font="block" />
                        </Gradient>
                        <Box marginTop={1} flexDirection="row" gap={2}>
                            <Box flexDirection="row" gap={1}>
                                <Text color="cyan" bold>Enter</Text>
                                <Text dimColor>发送</Text>
                            </Box>
                            <Text dimColor>|</Text>
                            <Box flexDirection="row" gap={1}>
                                <Text color="cyan" bold>Ctrl+A</Text>
                                <Text dimColor>自动模式</Text>
                            </Box>
                            <Text dimColor>|</Text>
                            <Box flexDirection="row" gap={1}>
                                <Text color="cyan" bold>↑/↓</Text>
                                <Text dimColor>历史</Text>
                            </Box>
                            <Text dimColor>|</Text>
                            <Box flexDirection="row" gap={1}>
                                <Text color="cyan" bold>Ctrl+C</Text>
                                <Text dimColor>退出</Text>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Static>

            {isLoading ? (
                <Box flexDirection="column" marginY={1}>
                    <Box flexDirection="row" alignItems="center" gap={1}>
                        <Spinner type="dots" />
                        <Text>{t('app.initializing')}...</Text>
                    </Box>
                </Box>
            ) : (
                <>
                    <Static items={stableMessages} key="static-history">
                        {(msg) => (
                            <MessageComponent
                                key={`${msg.timestamp.getTime()}-${Math.random()}`}
                                message={msg}
                            />
                        )}
                    </Static>
                    {activeMessages.map((msg) => (
                        <MessageComponent
                            key={`${msg.timestamp.getTime()}-${Math.random()}`}
                            message={msg}
                        />
                    ))}
                    <Box
                        flexDirection="column"
                        marginTop={
                            activeMessages.length > 0 || stableMessages.length > 0 ? 1 : 0
                        }
                    >
                        <Box flexDirection="row" justifyContent="space-between">
                            <Box flexDirection="row" alignItems="center" gap={1}>
                                <Text bold color="cyan">
                                    🚀 OpenShell {config.version}
                                </Text>
                            </Box>
                            <Box flexDirection="row" gap={2}>
                                <Text color="magenta">
                                    {t('status.autoExecuteLabel')}(Ctrl+A):{' '}
                                    {autoExecute ? '✓' : '✗'}
                                </Text>
                            </Box>
                        </Box>
                        <Separator />
                        <Box flexDirection="column" marginTop={1} marginBottom={1}>
                            {pendingInterrupt ? (
                                <Box flexDirection="column">
                                    <Text color="yellow" bold>
                                        Review Required:{' '}
                                        {pendingInterrupt.value?.action_requests?.[0]
                                            ?.description || 'Action requires approval'}
                                    </Text>
                                    <Box marginTop={1}>
                                        <SelectInput
                                            items={[
                                                { label: 'Approve', value: 'approve' },
                                                { label: 'Reject', value: 'reject' },
                                            ]}
                                            onSelect={(item) =>
                                                handleDecision(
                                                    item.value as 'approve' | 'reject',
                                                    pendingToolId,
                                                    pendingInterrupt,
                                                )
                                            }
                                        />
                                    </Box>
                                </Box>
                            ) : (
                                <Box flexDirection="row" alignItems="center">
                                    <Text color={isProcessing ? 'gray' : 'white'} bold>
                                        {'> '}
                                    </Text>
                                    <Box flexDirection="row">
                                        {isProcessing ? (
                                            inputValue ? (
                                                <Text dimColor>{inputValue}</Text>
                                            ) : (
                                                <Text color="yellow">
                                                    <Spinner type="dots" />
                                                </Text>
                                            )
                                        ) : (
                                            <>
                                                <Text>{inputValue.slice(0, cursorPosition)}</Text>
                                                <Text inverse>{inputValue[cursorPosition] || ' '}</Text>
                                                <Text>{inputValue.slice(cursorPosition + 1)}</Text>
                                            </>
                                        )}
                                    </Box>
                                </Box>
                            )}
                            {suggestions.length > 0 && (
                                <Box flexDirection="column" marginTop={1} paddingLeft={2} borderStyle="round" borderColor="gray">
                                    {suggestions.map((cmd, idx) => (
                                        <Box key={cmd}>
                                            <Text color={idx === selectedIndex ? 'cyan' : 'white'} bold={idx === selectedIndex}>
                                                {idx === selectedIndex ? '→ ' : '  '}
                                                /{cmd}
                                            </Text>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </Box>
                </>
            )}
            {config.debug && (
                <Box marginBottom={1}>
                    <Text color="yellow">DEBUG: {t('app.debugMode')}</Text>
                </Box>
            )}
        </Box>
    );
}
