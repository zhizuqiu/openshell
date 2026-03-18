import { useState, useEffect, useRef } from "react";
import { Box, useApp, useStdin, Static } from "ink";
import { ToolApprovalDialog } from "./ToolApprovalDialog.js";
import { createDataListener } from "./input/key-parser.js";
import type { Key } from "./input/key-parser.js";
import { Banner } from "./components/Banner.js";
import { StatusBar } from "./components/StatusBar.js";
import { InputBox } from "./components/InputBox.js";
import { SuggestionsList } from "./components/SuggestionsList.js";
import { LoadingIndicator } from "./components/LoadingIndicator.js";
import { SessionSelector } from "./components/SessionSelector.js";
import { FooterBar } from "./components/FooterBar.js";
import { DebugIndicator } from "./components/DebugIndicator.js";
import { useInputState } from "./hooks/useInputState.js";
import {
  createShellAgent,
  listAllSessions,
  deleteSession,
} from "../core/index.js";
import { killAllProcesses } from "../core/ai/tools.js";
import { getCommandManager } from "../core/session/command-manager.js";
import { questionManager, type QuestionRequest } from "../core/question.js";
import {
  parseToolResults,
  convertLangChainMessage,
  formatSessionMessages,
} from "../core/ai/message-utils.js";
import { AskUserDialog } from "./AskUserDialog.js";
import { t, getI18n } from "../i18n.js";
import { MessageComponent } from "./MessageComponent.js";
import type {
  AppContainerProps,
  Message,
  AssistantMessage,
  Interrupt,
} from "./types.js";
import {
  CustomMultiMessageRole as Role,
  AssistantMessageType as MsgType,
  ToolCallStatus,
} from "./types.js";
import { Command } from "@langchain/langgraph";
import type { ReactAgent } from "langchain";
import { BaseMessage, AIMessage, ToolMessage } from "@langchain/core/messages";

export function AppContainer({ config }: AppContainerProps) {
  // --- 初始化语言 ---
  if (config.lang) {
    getI18n().setLanguage(config.lang);
  }

  const {
    inputValue,
    setInputValue,
    cursorPosition,
    setCursorPosition,
    inputValueRef,
    cursorRef,
    isPastingRef,
    lastPasteEndRef,
    pasteBufferRef,
  } = useInputState();
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agent, setAgent] = useState<ReactAgent | null>(null);
  const [mode, setMode] = useState<"agent" | "shell">("agent");
  const [activeQuestionRequest, setActiveQuestionRequest] =
    useState<QuestionRequest | null>(null);
  const [currentDir] = useState(process.cwd());
  const [modelName, setModelName] = useState(
    process.env["OPENAI_API_MODEL"] || "gpt-4o",
  );

  // Session 管理相关状态
  const [activeSessionId, setActiveSessionId] = useState(
    config.sessionId || "main-session",
  );
  const [sessionList, setSessionList] = useState<
    { label: string; value: string }[]
  >([]);
  const [isSelectingSession, setIsSelectingSession] = useState(false);
  const [sessionSelectorIndex, setSessionSelectorIndex] = useState(0);
  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const currentAiMsgIndexRef = useRef<number>(-1);

  // 引用快照，用于在事件处理闭包中获取最新状态
  const messagesRef = useRef(messages);
  const isProcessingRef = useRef(isProcessing);
  const modeRef = useRef(mode);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // 开启 Bracketed Paste Mode
  useEffect(() => {
    process.stdout.write("\u001b[?2004h");
    return () => {
      process.stdout.write("\u001b[?2004l");
    };
  }, []);

  const loadSessionHistory = async (
    agentInstance: ReactAgent,
    threadId: string,
  ) => {
    setIsLoading(true);
    try {
      const state = await agentInstance.graph.getState({
        configurable: { thread_id: threadId },
      });

      if (state && state.values && Array.isArray(state.values.messages)) {
        const langChainMessages = state.values.messages as BaseMessage[];

        const toolResults = parseToolResults(langChainMessages);
        const processedMessages = langChainMessages
          .map((m) => convertLangChainMessage(m, toolResults))
          .filter((m): m is NonNullable<typeof m> => m !== null);

        const restoredMessages = formatSessionMessages(processedMessages);

        seenMessageIdsRef.current.clear();
        if (restoredMessages.length > 0) {
          setMessages([
            {
              role: Role.SYSTEM,
              content: t("app.loadingSession", { sessionId: threadId }),
              timestamp: new Date(),
            },
            ...restoredMessages,
            {
              role: Role.SYSTEM,
              content: t("app.switchedToSession", { sessionId: threadId }),
              timestamp: new Date(),
            },
          ]);
          langChainMessages.forEach((m) => {
            if (m.id) seenMessageIdsRef.current.add(m.id);
          });
        } else {
          setMessages([
            {
              role: Role.SYSTEM,
              content: t("app.welcome") + ` (Session: ${threadId})`,
              timestamp: new Date(),
            },
          ]);
        }
      } else {
        setMessages([
          {
            role: Role.SYSTEM,
            content: t("app.welcome") + ` (Session: ${threadId})`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (e) {
      console.error("Load History Error:", e);
      setMessages([
        {
          role: Role.SYSTEM,
          content: `Error loading session history for ${threadId}`,
          timestamp: new Date(),
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const [autoExecute, setAutoExecute] = useState(false);
  const [runningCommands, setRunningCommands] = useState(0);
  const queryExecutedRef = useRef(false);
  const activeStreamsRef = useRef(0);
  const seenMessageIdsRef = useRef(new Set<string>());
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastEscapeTimeRef = useRef(0);
  const cancelMessageAddedRef = useRef(false);
  const currentCommandRef = useRef<string>("");
  const currentStreamRef = useRef<AsyncGenerator<Record<string, any>> | null>(
    null,
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const suggestionsRef = useRef<string[]>([]);
  const selectedIndexRef = useRef(0);
  const cleanupKeyListenerRef = useRef<(() => void) | null>(null);

  const commandHistoryRef = useRef<string[]>([]);
  const shellHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const draftInputRef = useRef<string>("");

  const ALL_COMMANDS = ["help", "version", "exit", "command", "session"];

  useEffect(() => {
    if (inputValue.startsWith("/")) {
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
    const updateRunningCommands = () => {
      try {
        const commandManager = getCommandManager();
        const commands = commandManager.listCommands();
        const running = commands.filter((c) => c.status === "running").length;
        setRunningCommands(running);
      } catch {
        setRunningCommands(0);
      }
    };
    updateRunningCommands();
    const interval = setInterval(updateRunningCommands, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleQuestionRequested = (request: QuestionRequest) => {
      setActiveQuestionRequest(request);
    };
    questionManager.on("question_requested", handleQuestionRequested);
    return () => {
      questionManager.off("question_requested", handleQuestionRequested);
    };
  }, []);

  const { exit } = useApp();
  const { stdin, setRawMode } = useStdin();

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

  useEffect(() => {
    const initializeAgent = async () => {
      try {
        const apiKey = process.env["OPENAI_API_KEY"];
        const baseURL = process.env["OPENAI_BASE_URL"];
        const model = process.env["OPENAI_API_MODEL"] || "gpt-4o";

        if (!apiKey || !baseURL) {
          setMessages([
            {
              role: Role.SYSTEM,
              content: t("app.welcome"),
              timestamp: new Date(),
            },
            {
              role: Role.SYSTEM,
              content: t("app.aiNotConfigured"),
              timestamp: new Date(),
            },
          ]);
          setIsLoading(false);
          return;
        }

        const agentConfig = { apiKey, baseURL, model };
        const shellAgent = await createShellAgent(agentConfig);
        setAgent(shellAgent);
        setModelName(model);

        // --- 恢复历史记录 ---
        const threadId = config.sessionId || "main-session";
        const state = await shellAgent.graph.getState({
          configurable: { thread_id: threadId },
        });

        if (state && state.values && Array.isArray(state.values.messages)) {
          const langChainMessages = state.values.messages as any[];
          const restoredMessages: Message[] = langChainMessages
            .map((m) => {
              // 映射 LangChain 消息到 OpenShell UI 消息
              let role: Role = Role.ASSISTANT;
              if (m._getType() === "human") role = Role.USER;
              else if (m._getType() === "system") role = Role.SYSTEM;

              let content: any = m.content;

              // 尝试解析助手消息中的结构化数据（如果是 AssistantMessage 数组的字符串表示）
              if (role === Role.ASSISTANT && typeof content === "string") {
                try {
                  const parsed = JSON.parse(content);
                  if (Array.isArray(parsed)) content = parsed;
                } catch {
                  // 如果不是 JSON，保持原样（TEXT 块）
                  content = [{ type: MsgType.TEXT, content }];
                }
              }

              return {
                role,
                content,
                timestamp: new Date(
                  m.additional_kwargs?.timestamp || Date.now(),
                ),
              };
            })
            .filter((m) => m.role !== "system" || m.content !== ""); // 过滤掉空的系统消息

          if (restoredMessages.length > 0) {
            setMessages(restoredMessages);
            // 填充 seenMessageIdsRef 防止重复
            langChainMessages.forEach((m) => {
              if (m.id) seenMessageIdsRef.current.add(m.id);
            });
          } else {
            setMessages([
              {
                role: Role.SYSTEM,
                content: t("app.welcome"),
                timestamp: new Date(),
              },
            ]);
          }
        } else {
          setMessages([
            {
              role: Role.SYSTEM,
              content: t("app.welcome"),
              timestamp: new Date(),
            },
          ]);
        }
      } catch (error) {
        handleError(error);
      } finally {
        setIsLoading(false);
      }
    };
    initializeAgent();
  }, []);

  const cancelCurrentTask = async () => {
    if (cancelMessageAddedRef.current) return;
    cancelMessageAddedRef.current = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (cleanupKeyListenerRef.current) cleanupKeyListenerRef.current();
    if (currentStreamRef.current) {
      currentStreamRef.current.return?.(undefined);
      currentStreamRef.current = null;
    }
    killAllProcesses();
    activeStreamsRef.current = 0;
    isProcessingRef.current = false;
    setIsProcessing(false);

    const pendingMsg = messagesRef.current.find(messageHasInterrupt);
    if (pendingMsg && agent) {
      const block = (pendingMsg.content as AssistantMessage[]).find(
        (b) =>
          b.type === MsgType.TOOL_CALL &&
          b.tool_calls?.some((tc) => tc.interrupt),
      );
      const tc = block?.tool_calls?.find((t) => t.interrupt);
      if (tc && tc.interrupt) {
        // 拒绝所有待处理的操作
        const actionRequests =
          tc.interrupt.value?.actionRequests ||
          tc.interrupt.value?.action_requests ||
          [];
        const decisions = actionRequests.map(() => ({
          type: "reject" as const,
          message:
            "Operation cancelled by user (ESC pressed). Stop and ask for instructions.",
        }));
        await runAgent({ decisions });
        return;
      }
    }

    setMessages((prev) => {
      const next = [...prev];
      const aiIdx = next.findIndex(
        (m) => m.role === Role.ASSISTANT && m.streaming,
      );
      if (aiIdx !== -1) {
        next[aiIdx].streaming = false;
        const aiMsg = next[aiIdx];
        if (Array.isArray(aiMsg.content)) {
          for (const block of aiMsg.content) {
            if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
              for (const tc of block.tool_calls) {
                if (!tc.result) tc.result = "Command cancelled by user";
              }
            }
          }
        }
      }
      return next;
    });

    const command = currentCommandRef.current?.trim() || "当前操作";
    setMessages((prev) => [
      ...prev,
      {
        role: Role.ASSISTANT,
        content: `任务已取消：${command}（用户按下 ESC 键中断）`,
        timestamp: new Date(),
        error: true,
      },
    ]);
  };

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

    if (trimmed.startsWith("/")) {
      const cmd = trimmed.slice(1).toLowerCase().split(" ")[0];
      if (cmd === "clear") {
        setMessages([]);
        seenMessageIdsRef.current.clear();
        return;
      }
      if (cmd === "exit") {
        console.log(`\n\n  \x1b[36m${t("app.toResumeSession")}\x1b[0m`);
        console.log(`  \x1b[1mopenshell --session ${activeSessionId}\x1b[0m\n`);
        exit();
        setTimeout(() => process.exit(0), 100);
        return;
      }
      if (cmd === "version") {
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
      if (cmd === "help") {
        setMessages((prev) => [
          ...prev,
          {
            role: Role.ASSISTANT,
            content: `${t("help.availableCommands")}\n  /help    - ${t("help.helpCommand")}\n  /version - ${t("help.versionCommand")}\n  /clear   - ${t("help.clearCommand")}\n  /command - ${t("help.commandCommand")}\n  /exit    - ${t("help.exitCommand")}\n\n${t("help.withAiAgent")}`,
            timestamp: new Date(),
          },
        ]);
        return;
      }
      if (cmd === "command") {
        const commandManager = getCommandManager();
        const commands = commandManager.listCommands();
        if (commands.length === 0) {
          setMessages((prev) => [
            ...prev,
            {
              role: Role.ASSISTANT,
              content: "No background commands found.",
              timestamp: new Date(),
            },
          ]);
        } else {
          const summary = commands
            .map(
              (c) =>
                `- ID: ${c.id} | Status: ${c.status} | Command: ${c.command} | Duration: ${(c.duration / 1000).toFixed(1)}s`,
            )
            .join("\n");
          setMessages((prev) => [
            ...prev,
            {
              role: Role.ASSISTANT,
              content: `Background Commands (${commands.length}):\n${summary}\n\n${t("command.backgroundWarning")}`,
              timestamp: new Date(),
            },
          ]);
        }
        return;
      }
      if (cmd === "session") {
        const subCmd = trimmed.slice(1).trim().split(" ")[1];

        if (!subCmd) {
          // 显示 session 列表供选择
          setIsProcessing(true);
          listAllSessions()
            .then((sessions) => {
              if (sessions.length === 0) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: Role.ASSISTANT,
                    content: "No historical sessions found.",
                    timestamp: new Date(),
                  },
                ]);
                setIsProcessing(false);
                return;
              }
              const formatted = sessions.map((s) => ({
                label: `${s.thread_id} (Updated: ${new Date(s.updated_at).toLocaleString()})`,
                value: s.thread_id,
              }));
              setSessionList(formatted);
              setSessionSelectorIndex(0);
              setIsSelectingSession(true);
              setIsProcessing(false);
            })
            .catch((err) => {
              setMessages((prev) => [
                ...prev,
                {
                  role: Role.ASSISTANT,
                  content: t("app.failedToListSessions", {
                    error: err.message,
                  }),
                  timestamp: new Date(),
                  error: true,
                },
              ]);
              setIsProcessing(false);
            });
          return;
        } else {
          // 直接切换 session
          setActiveSessionId(subCmd);
          activeSessionIdRef.current = subCmd;
          if (agent) {
            void loadSessionHistory(agent, subCmd);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: Role.ASSISTANT,
                content: t("app.agentNotReadyError"),
                timestamp: new Date(),
                error: true,
              },
            ]);
          }
          return;
        }
      }
    }

    if (agent) {
      const pendingMsg = messagesRef.current.find(messageHasInterrupt);
      const resumeKeywords = ["继续", "continue", "ok", "yes", "y", ""];
      if (pendingMsg && resumeKeywords.includes(trimmed.toLowerCase())) {
        const block = (pendingMsg.content as AssistantMessage[]).find(
          (b) =>
            b.type === MsgType.TOOL_CALL &&
            b.tool_calls?.some((tc) => tc.interrupt),
        );
        const tc = block?.tool_calls?.find((t) => t.interrupt);
        if (tc && tc.interrupt) {
          // 为所有 action_requests 生成批准决策
          const actionRequests =
            tc.interrupt.value?.actionRequests ||
            tc.interrupt.value?.action_requests ||
            [];
          const decisions = actionRequests.map(() => ({
            type: "approve" as const,
          }));
          await runAgent({ decisions });
          return;
        }
      }
      await handleAiStream(trimmed);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: Role.ASSISTANT,
          content: "Agent not ready.",
          timestamp: new Date(),
        },
      ]);
      setIsProcessing(false);
    }
  };

  // 统一的 agent 调用入口：支持消息输入和决策恢复
  const runAgent = async (input: {
    messages?: Array<{ type: string; content: string }>;
    decisions?: Array<{ type: "approve" | "reject"; message?: string }>;
  }) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    cancelMessageAddedRef.current = false;
    activeStreamsRef.current++;
    setIsProcessing(true);
    try {
      // 构建 stream input：messages 或 decisions 二选一
      let streamInput: any;
      if (input.decisions) {
        streamInput = new Command({ resume: { decisions: input.decisions } });
        // 恢复时：找到最后一个 AI 消息作为更新目标
        setMessages((prev) => {
          const aiIdx = [...prev]
            .reverse()
            .findIndex((m) => m.role === Role.ASSISTANT);
          if (aiIdx !== -1) {
            currentAiMsgIndexRef.current = prev.length - 1 - aiIdx;
            // 重新设置 streaming 状态
            const next = [...prev];
            next[currentAiMsgIndexRef.current] = {
              ...next[currentAiMsgIndexRef.current],
              streaming: true,
            };
            return next;
          }
          return prev;
        });
      } else {
        streamInput = { messages: input.messages };
        // 只在初始消息时创建新的 AI 消息占位
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
      }

      if (!agent) return;
      const stream = await agent.stream(streamInput, {
        streamMode: "updates",
        configurable: { thread_id: activeSessionId },
      });
      currentStreamRef.current = stream;
      await processAiStream(stream, abortControllerRef.current);
      currentStreamRef.current = null;
    } catch (error) {
      if (!abortControllerRef.current?.signal.aborted) handleError(error);
    } finally {
      activeStreamsRef.current--;
      if (
        !abortControllerRef.current?.signal.aborted &&
        activeStreamsRef.current <= 0
      )
        setIsProcessing(false);
    }
  };

  const handleAiStream = async (cmd: string) => {
    currentCommandRef.current = cmd;
    await runAgent({ messages: [{ type: "human", content: cmd }] });
  };

  const processAiStream = async (
    stream: AsyncIterable<Record<string, any>>,
    abortController: AbortController,
  ) => {
    let hasInterrupt = false;
    const aiMsgIndex = currentAiMsgIndexRef.current;
    try {
      for await (const chunk of stream) {
        if (abortController.signal.aborted) return;
        if (!chunk || typeof chunk !== "object") continue;
        const nodeName = Object.keys(chunk)[0];
        const nodeData = chunk[nodeName] as { messages: BaseMessage[] };
        if (nodeData && Array.isArray(nodeData.messages)) {
          nodeData.messages = nodeData.messages.filter((msg: any) => {
            const rawId = msg.id || msg.kwargs?.id;
            const msgId = typeof rawId === "string" ? rawId : msg.kwargs?.id;
            if (
              typeof msgId === "string" &&
              seenMessageIdsRef.current.has(msgId)
            )
              return false;
            if (typeof msgId === "string") seenMessageIdsRef.current.add(msgId);
            return true;
          });
        }
        const firstMsg = nodeData?.messages?.[0];
        const interrupt =
          chunk["__interrupt__"]?.[0] ||
          (firstMsg instanceof AIMessage
            ? (
                firstMsg.additional_kwargs[
                  "interrupts"
                ] as unknown as Interrupt[]
              )?.[0]
            : null) ||
          (firstMsg as any)?.interrupt;
        if (interrupt && !hasInterrupt) {
          hasInterrupt = true;
          if (autoExecute) {
            // autoExecute 模式：为所有 action_requests 生成批准决策
            const actionRequests =
              interrupt.value?.actionRequests ||
              interrupt.value?.action_requests ||
              [];
            const decisions = actionRequests.map(() => ({
              type: "approve" as const,
            }));
            // 直接调用 runAgent 恢复，不经过 handleDecision
            runAgent({ decisions });
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

            // 获取所有待审批的工具调用 ID
            const actionRequests =
              interrupt.value?.actionRequests ||
              interrupt.value?.action_requests ||
              [];
            const pendingToolCallIds = new Set(
              actionRequests.map((ar: any) => ar.id).filter(Boolean),
            );

            // 给所有待审批的 tool_calls 标记 interrupt
            for (const block of assistantContent) {
              if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                for (const tc of block.tool_calls) {
                  // 如果 tool_call 在待审批列表中，或者没有 ID 列表时标记所有未完成的
                  if (
                    pendingToolCallIds.size > 0
                      ? pendingToolCallIds.has(tc.id)
                      : !tc.result
                  ) {
                    tc.interrupt = interrupt;
                  }
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
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);
          const toolCalls = msg.tool_calls || msg.kwargs?.tool_calls || [];
          let msgType = msg._getType?.() || msg.type || msg.kwargs?.type;
          const isTool =
            msgType === "tool" ||
            msg instanceof ToolMessage ||
            msg.id === "ToolMessage";
          const isAI =
            msgType === "ai" ||
            msg instanceof AIMessage ||
            msgType === "assistant";
          const role = isTool ? "tool" : isAI ? "assistant" : msgType;
          if (role === "human" || role === "system") continue;

          if (role === "tool") {
            const toolId =
              msg instanceof ToolMessage ? msg.tool_call_id : msg.id;

            setMessages((prev) => {
              const next = [...prev];
              // 倒序查找，因为通常是更新最近的消息
              for (let i = next.length - 1; i >= 0; i--) {
                const m = next[i];
                if (m.role === Role.ASSISTANT && Array.isArray(m.content)) {
                  for (const block of m.content) {
                    if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                      const tc = block.tool_calls.find((t) => t.id === toolId);
                      if (tc) {
                        // 解析结果
                        try {
                          const parsed = JSON.parse(content);
                          if (
                            parsed &&
                            typeof parsed === "object" &&
                            "status" in parsed
                          ) {
                            tc.status = parsed.status as ToolCallStatus;
                            tc.result =
                              parsed.output || parsed.result || content;
                          } else {
                            throw new Error("Not structured");
                          }
                        } catch {
                          tc.result = content;
                          const isRejected =
                            content.includes("rejected") ||
                            content.includes("cancelled") ||
                            content.includes("拒绝") ||
                            content.includes("取消");
                          if (isRejected) {
                            tc.status = ToolCallStatus.CANCELED;
                            tc.result =
                              t("hitl.rejectedFeedback") ||
                              "Operation rejected by user.";
                          } else {
                            tc.status = ToolCallStatus.SUCCESS;
                          }
                        }
                        return next;
                      }
                    }
                  }
                }
              }
              return next;
            });
          } else if (role === "assistant") {
            setMessages((prev) => {
              const next = [...prev];
              const idx = aiMsgIndex;
              if (idx === -1) return prev;
              const aiMsg = { ...next[idx] };
              const assistantContent = Array.isArray(aiMsg.content)
                ? [...aiMsg.content]
                : [];

              if (content) {
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
                // 合并所有 tool_calls 到同一个 TOOL_CALL block 中
                // 先收集所有新的 tool_call（之前没有出现过的）
                const existingToolCallIds = new Set<string>();
                assistantContent.forEach((block) => {
                  if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                    block.tool_calls.forEach((tc) => {
                      if (tc.id) existingToolCallIds.add(tc.id);
                    });
                  }
                });

                const newToolCalls = toolCalls
                  .filter((tc) => tc.id && !existingToolCallIds.has(tc.id))
                  .map((tc) => ({
                    id: tc.id || "",
                    name: tc.name!,
                    args: tc.args,
                    status: ToolCallStatus.EXECUTING,
                  }));

                if (newToolCalls.length > 0) {
                  // 查找现有的 TOOL_CALL block
                  let toolCallBlock = assistantContent.find(
                    (block) => block.type === MsgType.TOOL_CALL,
                  );

                  if (
                    toolCallBlock &&
                    toolCallBlock.type === MsgType.TOOL_CALL
                  ) {
                    // 合并到现有 block
                    toolCallBlock.tool_calls = [
                      ...(toolCallBlock.tool_calls || []),
                      ...newToolCalls,
                    ];
                  } else {
                    // 创建新的 TOOL_CALL block
                    assistantContent.push({
                      type: MsgType.TOOL_CALL,
                      tool_calls: newToolCalls,
                    });
                  }
                }
              }
              aiMsg.content = assistantContent;
              next[idx] = aiMsg;
              return next;
            });
          }
        }
      }
    } catch (e) {
      if (!abortController.signal.aborted) throw e;
    }
    setMessages((prev) => {
      const next = [...prev];
      const idx = aiMsgIndex;
      if (idx !== -1) next[idx].streaming = false;
      return next;
    });
    try {
      if (agent) {
        const history = await agent.graph.getState({
          configurable: { thread_id: activeSessionId },
        });
        if (history?.values?.messages) {
          (history.values.messages as BaseMessage[]).forEach((msg) => {
            if (msg.id) seenMessageIdsRef.current.add(msg.id);
          });
        }
      }
    } catch (e) {}
  };

  const handleError = (error: unknown) => {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    setMessages((prev) => [
      ...prev,
      {
        role: Role.ASSISTANT,
        content: t("app.systemError", { error: errorMsg }),
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

  useEffect(() => {
    setRawMode(true);
    const handleKey = (key: Key) => {
      // 1. 优先处理最关键的控制键：Ctrl+C
      if (key.ctrl && key.name === "c") {
        if (inputValueRef.current.length > 0 || inputValue.length > 0) {
          inputValueRef.current = "";
          cursorRef.current = 0;
          setInputValue("");
          setCursorPosition(0);
        } else {
          console.log(`\n\n  \x1b[36m${t("app.toResumeSession")}\x1b[0m`);
          console.log(
            `  \x1b[1mopenshell --session ${activeSessionId}\x1b[0m\n`,
          );
          exit();
          setTimeout(() => process.exit(0), 100);
        }
        return;
      }

      // 2. 会话选择模式按键处理（优先于其他按键）
      if (isSelectingSession) {
        if (key.name === "escape") {
          setIsSelectingSession(false);
          return;
        }
        if (key.name === "x") {
          const target = sessionList[sessionSelectorIndex];
          if (target) {
            void deleteSession(target.value).then(() => {
              listAllSessions().then((sessions) => {
                const formatted = sessions.map((s) => ({
                  label: `${s.thread_id} (Updated: ${new Date(s.updated_at).toLocaleString()})`,
                  value: s.thread_id,
                }));
                setSessionList(formatted);
                if (sessionSelectorIndex >= formatted.length) {
                  setSessionSelectorIndex(Math.max(0, formatted.length - 1));
                }
              });
            });
          }
          return;
        }
        if (key.name === "up") {
          setSessionSelectorIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.name === "down") {
          setSessionSelectorIndex((prev) =>
            Math.min(sessionList.length - 1, prev + 1),
          );
          return;
        }
        // Enter 键由 SelectInput 组件处理，这里跳过以避免重复触发
        return;
      }

      // 3. 处理 ESC 键：取消当前处理中的任务或 HITL 中断
      if (key.name === "escape") {
        const now = Date.now();
        if (now - lastEscapeTimeRef.current < 100) return;
        lastEscapeTimeRef.current = now;

        if (
          isProcessingRef.current ||
          messagesRef.current.some(messageHasInterrupt)
        ) {
          void cancelCurrentTask();
        }
        return;
      }

      // 获取当前最新状态快照
      const currentInputValue = inputValueRef.current;
      const currentCursorPosition = cursorRef.current;
      const currentMode = modeRef.current;

      // 2. 处理粘贴开始和结束
      if (key.name === "paste-start") {
        isPastingRef.current = true;
        pasteBufferRef.current = "";
        return;
      }
      if (key.name === "paste-end") {
        isPastingRef.current = false;
        lastPasteEndRef.current = Date.now();
        const pastedContent = pasteBufferRef.current;
        if (pastedContent) {
          const newValue =
            currentInputValue.slice(0, currentCursorPosition) +
            pastedContent +
            currentInputValue.slice(currentCursorPosition);
          const nextPos = currentCursorPosition + pastedContent.length;
          inputValueRef.current = newValue;
          cursorRef.current = nextPos;
          setInputValue(newValue);
          setCursorPosition(nextPos);
        }
        pasteBufferRef.current = "";
        return;
      }

      if (key.ctrl && key.name === "a") {
        setAutoExecute((prev) => !prev);
        return;
      }

      // --- Shell 模式逻辑 ---
      if (
        key.name === "!" &&
        currentCursorPosition === 0 &&
        currentMode === "agent"
      ) {
        setMode("shell");
        modeRef.current = "shell";
        return;
      }
      if (currentMode === "shell") {
        if (
          key.name === "escape" ||
          (key.name === "backspace" && currentCursorPosition === 0)
        ) {
          setMode("agent");
          modeRef.current = "agent";
          return;
        }
        if (
          !isPastingRef.current &&
          (key.name === "return" || key.name === "enter")
        ) {
          if (currentInputValue.trim()) {
            const command = currentInputValue.trim();
            shellHistoryRef.current.push(command);
            historyIndexRef.current = -1;
            setMessages((prev) => [
              ...prev,
              {
                role: Role.USER,
                content: `! ${command}`,
                timestamp: new Date(),
              },
            ]);
            void (async () => {
              try {
                setIsProcessing(true);
                isProcessingRef.current = true;
                const commandManager = getCommandManager();
                const { command_id, pid } = await commandManager.startCommand(
                  command,
                  "Shell mode command",
                );
                const output = await new Promise<string>((resolve) => {
                  const check = () => {
                    const cmd = commandManager.getCommand(command_id);
                    if (!cmd) {
                      resolve("Command not found");
                      return;
                    }
                    if (cmd.status === "running") {
                      setTimeout(check, 100);
                      return;
                    }
                    resolve(
                      commandManager.getCommandOutput(command_id) ||
                        `(exit code: ${cmd.exitCode})`,
                    );
                  };
                  check();
                });
                setMessages((prev) => [
                  ...prev,
                  {
                    role: Role.ASSISTANT,
                    content: `Command executed (PID: ${pid}):\n${output || "(no output)"}`,
                    timestamp: new Date(),
                  },
                ]);
              } catch (error) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: Role.ASSISTANT,
                    content: t("app.autoExecuteError", {
                      error:
                        error instanceof Error
                          ? error.message
                          : "Unknown error",
                    }),
                    timestamp: new Date(),
                    error: true,
                  },
                ]);
              } finally {
                setIsProcessing(false);
                isProcessingRef.current = false;
                setMode("agent");
                modeRef.current = "agent";
              }
            })();
            inputValueRef.current = "";
            cursorRef.current = 0;
            setInputValue("");
            setCursorPosition(0);
          }
          return;
        }
      }

      if (
        messagesRef.current.some(messageHasInterrupt) ||
        isProcessingRef.current
      )
        return;

      // --- 回车与粘贴保护 ---
      if (key.name === "return" || key.name === "enter") {
        const isActuallyPasting =
          isPastingRef.current || Date.now() - lastPasteEndRef.current < 50;
        if (!isActuallyPasting) {
          if (suggestionsRef.current.length > 0) {
            const picked = suggestionsRef.current[selectedIndexRef.current];
            handleCommand("/" + picked);
            inputValueRef.current = "";
            cursorRef.current = 0;
            setInputValue("");
            setCursorPosition(0);
            setSuggestions([]);
            suggestionsRef.current = [];
            return;
          }
          if (currentInputValue.trim()) {
            handleCommand(currentInputValue.trim());
            inputValueRef.current = "";
            cursorRef.current = 0;
            setInputValue("");
            setCursorPosition(0);
          }
        } else {
          const char = "\n";
          const newValue =
            currentInputValue.slice(0, currentCursorPosition) +
            char +
            currentInputValue.slice(currentCursorPosition);
          inputValueRef.current = newValue;
          cursorRef.current = currentCursorPosition + 1;
          setInputValue(newValue);
          setCursorPosition(currentCursorPosition + 1);
        }
        return;
      }

      // --- 导航与删除 ---
      if (key.name === "left") {
        const p = Math.max(0, cursorRef.current - 1);
        cursorRef.current = p;
        setCursorPosition(p);
        return;
      }
      if (key.name === "right") {
        const p = Math.min(inputValueRef.current.length, cursorRef.current + 1);
        cursorRef.current = p;
        setCursorPosition(p);
        return;
      }
      if (key.name === "up") {
        if (suggestionsRef.current.length > 0) {
          const nextIndex =
            (selectedIndexRef.current - 1 + suggestionsRef.current.length) %
            suggestionsRef.current.length;
          selectedIndexRef.current = nextIndex;
          setSelectedIndex(nextIndex);
          return;
        }
        const history =
          currentMode === "shell"
            ? shellHistoryRef.current
            : commandHistoryRef.current;
        if (history.length === 0) return;
        if (historyIndexRef.current === -1) {
          draftInputRef.current = inputValueRef.current;
          historyIndexRef.current = history.length - 1;
        } else if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
        } else return;
        const historicalCommand = history[historyIndexRef.current];
        inputValueRef.current = historicalCommand;
        cursorRef.current = historicalCommand.length;
        setInputValue(historicalCommand);
        setCursorPosition(historicalCommand.length);
        return;
      }
      if (key.name === "down") {
        if (suggestionsRef.current.length > 0) {
          const nextIndex =
            (selectedIndexRef.current + 1) % suggestionsRef.current.length;
          selectedIndexRef.current = nextIndex;
          setSelectedIndex(nextIndex);
          return;
        }
        const history =
          currentMode === "shell"
            ? shellHistoryRef.current
            : commandHistoryRef.current;
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
          inputValueRef.current = draftInputRef.current;
          cursorRef.current = draftInputRef.current.length;
          setInputValue(draftInputRef.current);
          setCursorPosition(draftInputRef.current.length);
          draftInputRef.current = "";
        }
        return;
      }
      if (key.name === "home") {
        cursorRef.current = 0;
        setCursorPosition(0);
        return;
      }
      if (key.name === "end") {
        cursorRef.current = inputValueRef.current.length;
        setCursorPosition(inputValueRef.current.length);
        return;
      }
      if (key.name === "backspace") {
        if (cursorRef.current > 0) {
          const newValue =
            inputValueRef.current.slice(0, cursorRef.current - 1) +
            inputValueRef.current.slice(cursorRef.current);
          const nextPos = cursorRef.current - 1;
          inputValueRef.current = newValue;
          cursorRef.current = nextPos;
          setInputValue(newValue);
          setCursorPosition(nextPos);
        }
        return;
      }
      if (key.name === "delete") {
        if (cursorRef.current < inputValueRef.current.length) {
          const newValue =
            inputValueRef.current.slice(0, cursorRef.current) +
            inputValueRef.current.slice(cursorRef.current + 1);
          inputValueRef.current = newValue;
          setInputValue(newValue);
        }
        return;
      }

      // --- 打字输入逻辑 (支持多字符 sequence) ---
      const isPrintable = key.sequence && !key.ctrl && !key.meta;
      if (
        isPrintable &&
        (key.name === "space" ||
          !key.name ||
          key.name.length === 1 ||
          isPastingRef.current)
      ) {
        const char = key.name === "space" ? " " : key.sequence;
        if (isPastingRef.current) {
          pasteBufferRef.current += char;
        } else {
          // 在处理打印字符时，立即使用最新的 Ref 拼接
          const latestValue = inputValueRef.current;
          const latestPos = cursorRef.current;
          const newValue =
            latestValue.slice(0, latestPos) +
            char +
            latestValue.slice(latestPos);
          const nextPos = latestPos + char.length;

          inputValueRef.current = newValue;
          cursorRef.current = nextPos;
          setInputValue(newValue);
          setCursorPosition(nextPos);
        }
      }
    };

    const { listener: dataListener, cleanup: cleanupKeyListener } =
      createDataListener(handleKey);
    if (activeQuestionRequest) {
      cleanupKeyListener();
      return;
    }
    cleanupKeyListenerRef.current = cleanupKeyListener;
    stdin.on("data", dataListener);
    return () => {
      stdin.off("data", dataListener);
      cleanupKeyListener();
    };
  }, [
    isProcessing,
    handleCommand,
    stdin,
    setRawMode,
    exit,
    activeQuestionRequest,
    mode,
  ]);

  const stableMessages = messages.filter(
    (m) => !m.streaming && !messageHasInterrupt(m),
  );
  const activeMessages = messages.filter(
    (m) => m.streaming || messageHasInterrupt(m),
  );
  const pendingInterruptMessages = activeMessages
    .filter(messageHasInterrupt)
    .flatMap((msg) => {
      if (!Array.isArray(msg.content)) return [];
      return (msg.content as AssistantMessage[])
        .filter((b) => b.type === MsgType.TOOL_CALL && b.tool_calls)
        .flatMap((b) => b.tool_calls || [])
        .filter((tc) => tc.interrupt);
    });

  const renderPendingApprovals = () => {
    if (pendingInterruptMessages.length === 0) return null;

    // 获取所有待确认的工具调用的 interrupt（它们共享同一个 interrupt）
    const firstInterrupt = pendingInterruptMessages[0]?.interrupt;
    if (!firstInterrupt) return null;

    return (
      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        <ToolApprovalDialog
          interrupt={firstInterrupt}
          onSubmit={async (decisions) => {
            // 提交前先清除 interrupt 标记，让 Dialog 消失
            setMessages((prev) => {
              const next = [...prev];
              for (const msg of next) {
                if (msg.role === Role.ASSISTANT && Array.isArray(msg.content)) {
                  for (const block of msg.content) {
                    if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                      block.tool_calls.forEach((tc) => {
                        if (tc.interrupt) delete tc.interrupt;
                      });
                    }
                  }
                }
              }
              return next;
            });
            // 使用统一的 runAgent 提交决策
            await runAgent({ decisions });
          }}
          onCancel={() => {
            // 取消审批：拒绝所有待处理的操作
            const actionRequestsCount =
              firstInterrupt.value?.actionRequests?.length ||
              firstInterrupt.value?.action_requests?.length ||
              1;
            const decisions = Array(actionRequestsCount).fill({
              type: "reject",
              message:
                "Operation rejected by user. Stop the current task and ask for next instructions.",
            });
            // 使用统一的 runAgent 提交决策
            runAgent({ decisions });
          }}
        />
      </Box>
    );
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner showBanner={config.showBanner} version={config.version} />

      {isLoading ? (
        <LoadingIndicator message={`${t("app.initializing")}...`} />
      ) : (
        <>
          <Static items={stableMessages} key="chat-history">
            {(msg, index) => (
              <MessageComponent
                key={`stable-${msg.timestamp.getTime()}-${index}`}
                message={msg}
              />
            )}
          </Static>
          {activeMessages.map((msg, index) => (
            <MessageComponent
              key={`active-${msg.timestamp.getTime()}-${index}`}
              message={msg}
            />
          ))}
          <Box flexDirection="column" marginTop={1}>
            <StatusBar
              version={config.version}
              sessionId={activeSessionId}
              mode={mode}
              runningCommands={runningCommands}
              autoExecute={autoExecute}
            />
            <Box flexDirection="column" marginTop={0} marginBottom={1}>
              {activeQuestionRequest ? (
                <AskUserDialog
                  request={activeQuestionRequest}
                  onFinished={() => setActiveQuestionRequest(null)}
                />
              ) : isSelectingSession ? (
                <SessionSelector
                  sessions={sessionList}
                  onSelect={(sessionId) => {
                    setIsSelectingSession(false);
                    const command = `/session ${sessionId}`;
                    void handleCommand(command);
                  }}
                />
              ) : pendingInterruptMessages.length > 0 ? (
                <Box flexDirection="column">{renderPendingApprovals()}</Box>
              ) : (
                <InputBox
                  mode={mode}
                  isProcessing={isProcessing}
                  inputValue={inputValue}
                  cursorPosition={cursorPosition}
                />
              )}
              <FooterBar
                currentDir={currentDir}
                modelName={modelName}
                mode={mode}
              />

              <SuggestionsList
                suggestions={suggestions}
                selectedIndex={selectedIndex}
              />
            </Box>
          </Box>
        </>
      )}
      <DebugIndicator visible={config.debug} />
    </Box>
  );
}
