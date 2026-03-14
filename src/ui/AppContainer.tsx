import { useState, useEffect, useRef } from "react";
import { Box, Text, useApp, useStdin, Static } from "ink";
import os from "os";
import path from "path";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import { createDataListener } from "./input/key-parser.js";
import type { Key } from "./input/key-parser.js";
import { createShellAgent } from "../core/index.js";
import { killAllProcesses } from "../core/ai/tools.js";
import { getCommandManager } from "../core/session/command-manager.js";
import { questionManager, type QuestionRequest } from "../core/question.js";
import { AskUserDialog } from "./AskUserDialog.js";
import { t } from "../i18n.js";
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
} from "./types.js";
import { Command } from "@langchain/langgraph";
import type { ReactAgent } from "langchain";
import { BaseMessage, AIMessage, ToolMessage } from "@langchain/core/messages";

export function AppContainer({ config }: AppContainerProps) {

  // --- 布局常量 ---
  const terminalWidth = process.stdout.columns || 80;
  const mainWidth = terminalWidth - 4; // 主容器宽度，对齐带边框的输入框
  const innerWidth = terminalWidth - 6; // 内部卡片宽度
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agent, setAgent] = useState<ReactAgent | null>(null);
  const [mode, setMode] = useState<"agent" | "shell">("agent");
  const [activeQuestionRequest, setActiveQuestionRequest] = useState<QuestionRequest | null>(null);
  const [currentDir] = useState(process.cwd());
  const [modelName, setModelName] = useState(process.env["OPENAI_API_MODEL"] || "gpt-3.5-turbo");

  const isPastingRef = useRef(false); // 是否处于粘贴过程中
  const lastPasteEndRef = useRef(0); // 上次粘贴结束的时间戳
  const pasteBufferRef = useRef(""); // 粘贴内容缓冲区
  const currentAiMsgIndexRef = useRef<number>(-1); // 当前正在执行流式更新的 AI 消息索引

  // 引用快照，用于在事件处理闭包中获取最新状态
  const messagesRef = useRef(messages);
  const isProcessingRef = useRef(isProcessing);
  const inputValueRef = useRef(inputValue);
  const cursorRef = useRef(cursorPosition);
  const modeRef = useRef(mode);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { inputValueRef.current = inputValue; }, [inputValue]);
  useEffect(() => { cursorRef.current = cursorPosition; }, [cursorPosition]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // 开启 Bracketed Paste Mode
  useEffect(() => {
    process.stdout.write("\u001b[?2004h");
    return () => {
      process.stdout.write("\u001b[?2004l");
    };
  }, []);

  const tildeifyPath = (fullPath: string) => {
    const home = os.homedir();
    if (fullPath === home) return "~";
    if (fullPath.startsWith(home)) {
      return `~${path.sep}${path.relative(home, fullPath)}`;
    }
    return fullPath;
  };

  const shortenPath = (p: string, maxLen: number = 40) => {
    if (p.length <= maxLen) return p;
    const segments = p.split(path.sep).filter(Boolean);
    if (segments.length <= 2) return p;

    const first = segments[0];
    const last = segments[segments.length - 1];
    const isTilde = p.startsWith("~");
    
    const start = isTilde ? "~" : `${path.sep}${first}`;
    const result = `${start}${path.sep}...${path.sep}${last}`;
    
    return result.length > maxLen ? last : result;
  };

  const [autoExecute, setAutoExecute] = useState(true);
  const [runningCommands, setRunningCommands] = useState(0);
  const queryExecutedRef = useRef(false);
  const activeStreamsRef = useRef(0);
  const seenMessageIdsRef = useRef(new Set<string>());
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastEscapeTimeRef = useRef(0);
  const cancelMessageAddedRef = useRef(false);
  const currentCommandRef = useRef<string>("");
  const currentStreamRef = useRef<AsyncGenerator<Record<string, any>> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const suggestionsRef = useRef<string[]>([]);
  const selectedIndexRef = useRef(0);
  const cleanupKeyListenerRef = useRef<(() => void) | null>(null);

  const commandHistoryRef = useRef<string[]>([]);
  const shellHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const draftInputRef = useRef<string>("");

  const ALL_COMMANDS = ["help", "version", "exit", "command"];

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
        const model = process.env["OPENAI_API_MODEL"] || "gpt-3.5-turbo";

        if (!apiKey || !baseURL) {
          setMessages([{ role: Role.SYSTEM, content: t("app.welcome"), timestamp: new Date() }, { role: Role.SYSTEM, content: t("app.aiNotConfigured"), timestamp: new Date() }]);
          setIsLoading(false);
          return;
        }

        const agentConfig = { apiKey, baseURL, model };
        const shellAgent = await createShellAgent(agentConfig);
        setAgent(shellAgent);
        setModelName(model);
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
      const block = (pendingMsg.content as AssistantMessage[]).find(b => b.type === MsgType.TOOL_CALL && b.tool_calls?.some(tc => tc.interrupt));
      const tc = block?.tool_calls?.find(t => t.interrupt);
      if (tc && tc.interrupt) {
        await handleDecision("reject", tc.id || "", tc.interrupt);
        return;
      }
    }

    setMessages((prev) => {
      const next = [...prev];
      const aiIdx = next.findIndex(m => m.role === Role.ASSISTANT && m.streaming);
      if (aiIdx !== -1) {
        next[aiIdx].streaming = false;
        const aiMsg = next[aiIdx];
        if (Array.isArray(aiMsg.content)) {
          for (const block of aiMsg.content) {
            if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
              for (const tc of block.tool_calls) { if (!tc.result) tc.result = "Command cancelled by user"; }
            }
          }
        }
      }
      return next;
    });

    const command = currentCommandRef.current?.trim() || "当前操作";
    setMessages((prev) => [...prev, { role: Role.ASSISTANT, content: `任务已取消：${command}（用户按下 ESC 键中断）`, timestamp: new Date(), error: true }]);
  };

  const handleCommand = async (command: string, isFromQuery: boolean = false) => {
    const trimmed = command.trim();
    if (!isFromQuery) {
      commandHistoryRef.current.push(trimmed);
      historyIndexRef.current = -1;
      setMessages((prev) => [...prev, { role: Role.USER, content: trimmed, timestamp: new Date() }]);
    }

    if (trimmed.startsWith("/")) {
      const cmd = trimmed.slice(1).toLowerCase().split(" ")[0];
      if (cmd === "clear") { setMessages([]); seenMessageIdsRef.current.clear(); return; }
      if (cmd === "exit") { exit(); setTimeout(() => process.exit(0), 100); return; }
      if (cmd === "version") { setMessages((prev) => [...prev, { role: Role.ASSISTANT, content: `OpenShell ${config.version}`, timestamp: new Date() }]); return; }
      if (cmd === "help") {
        setMessages((prev) => [...prev, { role: Role.ASSISTANT, content: `${t("help.availableCommands")}\n  /help    - ${t("help.helpCommand")}\n  /version - ${t("help.versionCommand")}\n  /clear   - ${t("help.clearCommand")}\n  /command - ${t("help.commandCommand")}\n  /exit    - ${t("help.exitCommand")}\n\n${t("help.withAiAgent")}`, timestamp: new Date() }]);
        return;
      }
      if (cmd === "command") {
        const commandManager = getCommandManager();
        const commands = commandManager.listCommands();
        if (commands.length === 0) {
          setMessages((prev) => [...prev, { role: Role.ASSISTANT, content: "No background commands found.", timestamp: new Date() }]);
        } else {
          const summary = commands.map(c => `- ID: ${c.id} | Status: ${c.status} | Command: ${c.command} | Duration: ${(c.duration / 1000).toFixed(1)}s`).join("\n");
          setMessages((prev) => [...prev, { role: Role.ASSISTANT, content: `Background Commands (${commands.length}):\n${summary}\n\n${t("command.backgroundWarning")}`, timestamp: new Date() }]);
        }
        return;
      }
    }

    if (agent) {
      const pendingMsg = messagesRef.current.find(messageHasInterrupt);
      const resumeKeywords = ["继续", "continue", "ok", "yes", "y", ""];
      if (pendingMsg && resumeKeywords.includes(trimmed.toLowerCase())) {
        const block = (pendingMsg.content as AssistantMessage[]).find(b => b.type === MsgType.TOOL_CALL && b.tool_calls?.some(tc => tc.interrupt));
        const tc = block?.tool_calls?.find(t => t.interrupt);
        if (tc && tc.interrupt) { await handleDecision("approve", tc.id || "", tc.interrupt); return; }
      }
      await handleAiStream(trimmed);
    } else {
      setMessages((prev) => [...prev, { role: Role.ASSISTANT, content: "Agent not ready.", timestamp: new Date() }]);
      setIsProcessing(false);
    }
  };

  const handleAiStream = async (cmd: string) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    cancelMessageAddedRef.current = false;
    currentCommandRef.current = cmd;
    activeStreamsRef.current++;
    setIsProcessing(true);
    try {
      setMessages((prev) => {
        const next = [...prev, { role: Role.ASSISTANT, content: [], timestamp: new Date(), streaming: true }];
        currentAiMsgIndexRef.current = next.length - 1;
        return next;
      });
      if (!agent) return;
      const stream = await agent.stream({ messages: [{ role: Role.USER, content: cmd }] }, { streamMode: "updates", configurable: { thread_id: "main-session" } });
      currentStreamRef.current = stream;
      await processAiStream(stream, abortControllerRef.current);
      currentStreamRef.current = null;
    } catch (error) {
      if (!abortControllerRef.current?.signal.aborted) handleError(error);
    } finally {
      activeStreamsRef.current--;
      if (!abortControllerRef.current?.signal.aborted && activeStreamsRef.current <= 0) setIsProcessing(false);
    }
  };

  const processAiStream = async (stream: AsyncIterable<Record<string, any>>, abortController: AbortController) => {
    let lastToolCallId: string | null = null;
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
            if (typeof msgId === "string" && seenMessageIdsRef.current.has(msgId)) return false;
            if (typeof msgId === "string") seenMessageIdsRef.current.add(msgId);
            return true;
          });
        }
        const firstMsg = nodeData?.messages?.[0];
        const interrupt = chunk["__interrupt__"]?.[0] || (firstMsg instanceof AIMessage ? (firstMsg.additional_kwargs["interrupts"] as unknown as Interrupt[])?.[0] : null) || (firstMsg as any)?.interrupt;
        if (interrupt && !hasInterrupt) {
          hasInterrupt = true;
          if (autoExecute) { handleDecision("approve", lastToolCallId || "", interrupt); return; }
          setMessages((prev) => {
            const next = [...prev];
            const idx = aiMsgIndex;
            if (idx === -1) return prev;
            const aiMsg = { ...next[idx] };
            const assistantContent = Array.isArray(aiMsg.content) ? [...aiMsg.content] : [];
            for (const block of assistantContent) {
              if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                const tc = block.tool_calls.find(t => !t.result && (lastToolCallId ? t.id === lastToolCallId : true));
                if (tc) { tc.interrupt = interrupt; break; }
              }
            }
            aiMsg.content = assistantContent; next[idx] = aiMsg; return next;
          });
        }
        if (!nodeData || !Array.isArray(nodeData.messages)) continue;
        for (const msg of nodeData.messages as any[]) {
          const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
          const toolCalls = msg.tool_calls || msg.kwargs?.tool_calls || [];
          let msgType = msg._getType?.() || msg.type || msg.kwargs?.type;
          const isTool = msgType === "tool" || msg instanceof ToolMessage || msg.id === "ToolMessage";
          const isAI = msgType === "ai" || msg instanceof AIMessage || msgType === "assistant";
          const role = isTool ? "tool" : isAI ? "assistant" : msgType;
          if (role === "human" || role === "system") continue;
          setMessages((prev) => {
            const next = [...prev];
            const idx = aiMsgIndex;
            if (idx === -1) return prev;
            const aiMsg = { ...next[idx] };
            const assistantContent = Array.isArray(aiMsg.content) ? [...aiMsg.content] : [];
            if (role === "assistant") {
              if (content) {
                const lastTextBlock = assistantContent[assistantContent.length - 1];
                if (lastTextBlock && lastTextBlock.type === MsgType.TEXT && lastTextBlock.content !== content) {
                  lastTextBlock.content = content;
                } else if (!lastTextBlock || lastTextBlock.type !== MsgType.TEXT) {
                  assistantContent.push({ type: MsgType.TEXT, content });
                }
              }
              if (toolCalls && Array.isArray(toolCalls)) {
                lastToolCallId = toolCalls[0]?.id || null;
                const exists = assistantContent.some(block => block.type === MsgType.TOOL_CALL && block.tool_calls?.some(tc => tc.id === lastToolCallId));
                if (!exists) {
                  assistantContent.push({ type: MsgType.TOOL_CALL, tool_calls: toolCalls.map(tc => ({ id: tc.id || "", name: tc.name, args: tc.args })) });
                }
              }
            } else if (role === "tool") {
              const toolId = msg instanceof ToolMessage ? msg.tool_call_id : msg.id;
              for (const block of assistantContent) {
                if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                  const tc = block.tool_calls.find(t => t.id === toolId);
                  if (tc) tc.result = content;
                }
              }
            }
            aiMsg.content = assistantContent; next[idx] = aiMsg; return next;
          });
        }
      }
    } catch (e) { if (!abortController.signal.aborted) throw e; }
    setMessages((prev) => {
      const next = [...prev];
      const idx = aiMsgIndex;
      if (idx !== -1) next[idx].streaming = false;
      return next;
    });
    try {
      if (agent) {
        const history = await agent.graph.getState({ configurable: { thread_id: "main-session" } });
        if (history?.values?.messages) { (history.values.messages as BaseMessage[]).forEach(msg => { if (msg.id) seenMessageIdsRef.current.add(msg.id); }); }
      }
    } catch (e) {}
  };

  const handleDecision = async (decision: "approve" | "reject", toolId: string, interrupt?: Interrupt) => {
    if (!agent || !interrupt) return;
    activeStreamsRef.current++;
    setIsProcessing(true);
    try {
      setMessages((prev) => {
        const next = [...prev];
        const aiIdx = [...next].reverse().findIndex(m => m.role === Role.ASSISTANT);
        if (aiIdx !== -1) {
          const idx = next.length - 1 - aiIdx;
          next[idx] = { ...next[idx], streaming: true };
          currentAiMsgIndexRef.current = idx;
        }
        for (const msg of next) {
          if (msg.role === Role.ASSISTANT && Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === MsgType.TOOL_CALL && block.tool_calls) {
                block.tool_calls.forEach(tc => { if (tc.interrupt) delete tc.interrupt; });
              }
            }
          }
        }
        return next;
      });
      let decisions = [{ type: decision }];
      if (interrupt?.value?.action_requests) decisions = interrupt.value.action_requests.map(() => ({ type: decision }));
      const stream = await agent.stream(new Command({ resume: { [interrupt.id]: { decisions } } }) as any, { streamMode: "updates", configurable: { thread_id: "main-session" } });
      await processAiStream(stream, abortControllerRef.current!);
    } catch (error) { handleError(error); } finally { activeStreamsRef.current--; if (activeStreamsRef.current <= 0) setIsProcessing(false); }
  };

  const handleError = (error: unknown) => {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    setMessages((prev) => [...prev, { role: Role.ASSISTANT, content: `System Error: ${errorMsg}`, timestamp: new Date(), error: true }]);
  };

  useEffect(() => {
    if (config.query && !config.interactive && agent && !queryExecutedRef.current) {
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
          exit();
          setTimeout(() => process.exit(0), 100);
        }
        return;
      }

      // 2. 处理 ESC 键：取消当前处理中的任务或 HITL 中断
      if (key.name === "escape") {
        const now = Date.now();
        if (now - lastEscapeTimeRef.current < 100) return;
        lastEscapeTimeRef.current = now;

        if (isProcessingRef.current || messagesRef.current.some(messageHasInterrupt)) {
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
          const newValue = currentInputValue.slice(0, currentCursorPosition) + pastedContent + currentInputValue.slice(currentCursorPosition);
          const nextPos = currentCursorPosition + pastedContent.length;
          inputValueRef.current = newValue;
          cursorRef.current = nextPos;
          setInputValue(newValue);
          setCursorPosition(nextPos);
        }
        pasteBufferRef.current = "";
        return;
      }

      if (key.ctrl && key.name === "a") { setAutoExecute((prev) => !prev); return; }

      // --- Shell 模式逻辑 ---
      if (key.name === "!" && currentCursorPosition === 0 && currentMode === "agent") { 
        setMode("shell"); 
        modeRef.current = "shell";
        return; 
      }
      if (currentMode === "shell") {
        if (key.name === "escape" || (key.name === "backspace" && currentCursorPosition === 0)) { 
          setMode("agent"); 
          modeRef.current = "agent";
          return; 
        }
        if (!isPastingRef.current && (key.name === "return" || key.name === "enter")) {
          if (currentInputValue.trim()) {
            const command = currentInputValue.trim();
            shellHistoryRef.current.push(command);
            historyIndexRef.current = -1;
            setMessages((prev) => [...prev, { role: Role.USER, content: `! ${command}`, timestamp: new Date() }]);
            void (async () => {
              try {
                setIsProcessing(true); isProcessingRef.current = true;
                const commandManager = getCommandManager();
                const { command_id, pid } = await commandManager.startCommand(command, "Shell mode command");
                const output = await new Promise<string>((resolve) => {
                  const check = () => {
                    const cmd = commandManager.getCommand(command_id);
                    if (!cmd) { resolve("Command not found"); return; }
                    if (cmd.status === "running") { setTimeout(check, 100); return; }
                    resolve(commandManager.getCommandOutput(command_id) || `(exit code: ${cmd.exitCode})`);
                  };
                  check();
                });
                setMessages((prev) => [...prev, { role: Role.ASSISTANT, content: `Command executed (PID: ${pid}):\n${output || "(no output)"}`, timestamp: new Date() }]);
              } catch (error) {
                setMessages((prev) => [...prev, { role: Role.ASSISTANT, content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`, timestamp: new Date(), error: true }]);
              } finally { setIsProcessing(false); isProcessingRef.current = false; setMode("agent"); modeRef.current = "agent"; }
            })();
            inputValueRef.current = ""; cursorRef.current = 0;
            setInputValue(""); setCursorPosition(0);
          }
          return;
        }
      }

      if (messagesRef.current.some(messageHasInterrupt) || isProcessingRef.current) return;

      // --- 回车与粘贴保护 ---
      if (key.name === "return" || key.name === "enter") {
        const isActuallyPasting = isPastingRef.current || (Date.now() - lastPasteEndRef.current < 50);
        if (!isActuallyPasting) {
          if (suggestionsRef.current.length > 0) {
            const picked = suggestionsRef.current[selectedIndexRef.current];
            handleCommand("/" + picked);
            inputValueRef.current = ""; cursorRef.current = 0;
            setInputValue(""); setCursorPosition(0); setSuggestions([]); suggestionsRef.current = [];
            return;
          }
          if (currentInputValue.trim()) {
            handleCommand(currentInputValue.trim());
            inputValueRef.current = ""; cursorRef.current = 0;
            setInputValue(""); setCursorPosition(0);
          }
        } else {
          const char = "\n";
          const newValue = currentInputValue.slice(0, currentCursorPosition) + char + currentInputValue.slice(currentCursorPosition);
          inputValueRef.current = newValue; cursorRef.current = currentCursorPosition + 1;
          setInputValue(newValue); setCursorPosition(currentCursorPosition + 1);
        }
        return;
      }

      // --- 导航与删除 ---
      if (key.name === "left") { 
        const p = Math.max(0, cursorRef.current - 1);
        cursorRef.current = p; setCursorPosition(p); 
        return; 
      }
      if (key.name === "right") { 
        const p = Math.min(inputValueRef.current.length, cursorRef.current + 1);
        cursorRef.current = p; setCursorPosition(p); 
        return; 
      }
      if (key.name === "up") {
        if (suggestionsRef.current.length > 0) {
          const nextIndex = (selectedIndexRef.current - 1 + suggestionsRef.current.length) % suggestionsRef.current.length;
          selectedIndexRef.current = nextIndex; setSelectedIndex(nextIndex); return;
        }
        const history = currentMode === "shell" ? shellHistoryRef.current : commandHistoryRef.current;
        if (history.length === 0) return;
        if (historyIndexRef.current === -1) { draftInputRef.current = inputValueRef.current; historyIndexRef.current = history.length - 1; }
        else if (historyIndexRef.current > 0) { historyIndexRef.current -= 1; } else return;
        const historicalCommand = history[historyIndexRef.current];
        inputValueRef.current = historicalCommand; cursorRef.current = historicalCommand.length;
        setInputValue(historicalCommand); setCursorPosition(historicalCommand.length);
        return;
      }
      if (key.name === "down") {
        if (suggestionsRef.current.length > 0) {
          const nextIndex = (selectedIndexRef.current + 1) % suggestionsRef.current.length;
          selectedIndexRef.current = nextIndex; setSelectedIndex(nextIndex); return;
        }
        const history = currentMode === "shell" ? shellHistoryRef.current : commandHistoryRef.current;
        if (historyIndexRef.current === -1) return;
        if (historyIndexRef.current < history.length - 1) {
          historyIndexRef.current += 1;
          const historicalCommand = history[historyIndexRef.current];
          inputValueRef.current = historicalCommand; cursorRef.current = historicalCommand.length;
          setInputValue(historicalCommand); setCursorPosition(historicalCommand.length);
        } else {
          historyIndexRef.current = -1;
          inputValueRef.current = draftInputRef.current; cursorRef.current = draftInputRef.current.length;
          setInputValue(draftInputRef.current); setCursorPosition(draftInputRef.current.length);
          draftInputRef.current = "";
        }
        return;
      }
      if (key.name === "home") { cursorRef.current = 0; setCursorPosition(0); return; }
      if (key.name === "end") { cursorRef.current = inputValueRef.current.length; setCursorPosition(inputValueRef.current.length); return; }
      if (key.name === "backspace") {
        if (cursorRef.current > 0) {
          const newValue = inputValueRef.current.slice(0, cursorRef.current - 1) + inputValueRef.current.slice(cursorRef.current);
          const nextPos = cursorRef.current - 1;
          inputValueRef.current = newValue; cursorRef.current = nextPos;
          setInputValue(newValue); setCursorPosition(nextPos);
        }
        return;
      }
      if (key.name === "delete") {
        if (cursorRef.current < inputValueRef.current.length) {
          const newValue = inputValueRef.current.slice(0, cursorRef.current) + inputValueRef.current.slice(cursorRef.current + 1);
          inputValueRef.current = newValue; setInputValue(newValue);
        }
        return;
      }

      // --- 打字输入逻辑 (支持多字符 sequence) ---
      const isPrintable = key.sequence && !key.ctrl && !key.meta;
      if (isPrintable && (key.name === "space" || !key.name || key.name.length === 1 || isPastingRef.current)) {
        const char = key.name === "space" ? " " : key.sequence;
        if (isPastingRef.current) {
          pasteBufferRef.current += char;
        } else {
          // 在处理打印字符时，立即使用最新的 Ref 拼接
          const latestValue = inputValueRef.current;
          const latestPos = cursorRef.current;
          const newValue = latestValue.slice(0, latestPos) + char + latestValue.slice(latestPos);
          const nextPos = latestPos + char.length;
          
          inputValueRef.current = newValue;
          cursorRef.current = nextPos;
          setInputValue(newValue);
          setCursorPosition(nextPos);
        }
      }
    };

    const { listener: dataListener, cleanup: cleanupKeyListener } = createDataListener(handleKey);
    if (activeQuestionRequest) { cleanupKeyListener(); return; }
    cleanupKeyListenerRef.current = cleanupKeyListener;
    stdin.on("data", dataListener);
    return () => { stdin.off("data", dataListener); cleanupKeyListener(); };
  }, [isProcessing, handleCommand, stdin, setRawMode, exit, activeQuestionRequest, mode]);

  const stableMessages = messages.filter((m) => !m.streaming && !messageHasInterrupt(m));
  const activeMessages = messages.filter((m) => m.streaming || messageHasInterrupt(m));
  const pendingInterruptMessages = activeMessages.filter(messageHasInterrupt).flatMap((msg) => {
    if (!Array.isArray(msg.content)) return [];
    return (msg.content as AssistantMessage[]).filter((b) => b.type === MsgType.TOOL_CALL && b.tool_calls).flatMap((b) => b.tool_calls || []).filter((tc) => tc.interrupt);
  });

  const renderPendingApprovals = () => {
    if (pendingInterruptMessages.length === 0) return null;

    return (
      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        <Text color="yellow" bold>Review Required ({pendingInterruptMessages.length} actions):</Text>
        {pendingInterruptMessages.map((tc, index) => {
          if (!tc.interrupt) return null;
          return (
            <Box key={tc.id || index} flexDirection="column" marginLeft={2} marginTop={1} padding={1} borderStyle="round" borderColor="yellow" width={innerWidth}>
              <Text color="yellow" bold>{index + 1}. {tc.name}</Text>
              <Text dimColor wrap="wrap">{Object.entries(tc.args).map(([k, v]) => `${k}: ${v}`).join(", ")}</Text>
              <Text color="yellow" dimColor wrap="wrap">{tc.interrupt.value?.action_requests?.[0]?.description || "Action requires approval"}</Text>
              <Box marginTop={1}><SelectInput items={[{ label: t("hitl.approveLabel"), value: "approve" }, { label: t("hitl.rejectLabel"), value: "reject" }]} onSelect={(item) => handleDecision(item.value as "approve" | "reject", tc.id || "", tc.interrupt!)} /></Box>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Static items={["banner"]} key="brand-banner">
        {(item) => (
          <Box key={item} marginBottom={1} flexDirection="column" alignItems="center" width="100%">
            <Gradient name="morning"><BigText text="OpenShell" font="block" /></Gradient>
            <Box marginTop={1} flexDirection="row" gap={2}>
              <Box flexDirection="row" gap={1}><Text color="cyan" bold>Enter</Text><Text dimColor>{t("shortcuts.sendLabel")}</Text></Box>
              <Text dimColor>|</Text>
              <Box flexDirection="row" gap={1}><Text color="cyan" bold>Esc</Text><Text dimColor>{t("shortcuts.cancelLabel")}</Text></Box>
              <Text dimColor>|</Text>
              <Box flexDirection="row" gap={1}><Text color="cyan" bold>Ctrl+A</Text><Text dimColor>{t("status.autoExecuteLabel")}</Text></Box>
              <Text dimColor>|</Text>
              <Box flexDirection="row" gap={1}><Text color="cyan" bold>↑/↓</Text><Text dimColor>{t("shortcuts.historyLabel")}</Text></Box>
              <Text dimColor>|</Text>
              <Box flexDirection="row" gap={1}><Text color="cyan" bold>Ctrl+C</Text><Text dimColor>{t("shortcuts.exitLabel")}</Text></Box>
            </Box>
          </Box>
        )}
      </Static>

      {isLoading ? (
        <Box flexDirection="column" marginY={1}>
          <Box flexDirection="row" alignItems="center" gap={1}><Spinner type="dots" /><Text>{t("app.initializing")}...</Text></Box>
        </Box>
      ) : (
        <>
          <Static items={stableMessages} key="static-history">
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
            <Box flexDirection="row" justifyContent="space-between" width={mainWidth}>
              <Box flexDirection="row" alignItems="center" gap={1}>
                <Text bold color="cyan">OpenShell {config.version}</Text>
                <Text dimColor>|</Text>
                <Text bold color={mode === "shell" ? "green" : "cyan"}>[{mode === "shell" ? "Shell" : "Agent"}]</Text>
              </Box>
              <Box flexDirection="row" gap={2}>
                <Text color="magenta">{t("status.runningLabel")}: {runningCommands} |</Text>
                <Text color="magenta">{t("status.autoExecuteLabel")}(Ctrl+A): {autoExecute ? "✓" : "✗"}</Text>
              </Box>
            </Box>
            <Box flexDirection="column" marginTop={0} marginBottom={1}>
              {activeQuestionRequest ? (
                <AskUserDialog request={activeQuestionRequest} onFinished={() => setActiveQuestionRequest(null)} />
              ) : pendingInterruptMessages.length > 0 ? (
                <Box flexDirection="column">{renderPendingApprovals()}</Box>
              ) : (
                <Box flexDirection="row" paddingX={1} borderStyle="round" borderColor={isProcessing ? "gray" : mode === "shell" ? "green" : "cyan"} alignItems="flex-start" width={mainWidth}>
                  <Text color={isProcessing ? "gray" : mode === "shell" ? "green" : "cyan"} bold>{mode === "shell" ? "! " : "> "}</Text>
                  <Box flexGrow={1}>
                    {isProcessing ? (
                      inputValue ? <Text dimColor wrap="wrap">{inputValue}</Text> : <Box flexDirection="row"><Text color="yellow"><Spinner type="dots" /></Text><Text dimColor> Processing...</Text></Box>
                    ) : inputValue.length === 0 ? (
                      <Text><Text inverse>T</Text><Text dimColor>ype your message or ! for shell mode</Text></Text>
                    ) : (
                      <Text wrap="wrap"><Text>{inputValue.slice(0, cursorPosition)}</Text><Text inverse>{inputValue[cursorPosition] || " "}</Text><Text>{inputValue.slice(cursorPosition + 1)}</Text></Text>
                    )}
                  </Box>
                </Box>
              )}
              <Box paddingX={2} marginTop={0} marginBottom={1} flexDirection="row" justifyContent="space-between" width={mainWidth}>
                <Box>
                  <Text dimColor color="gray">
                    {shortenPath(tildeifyPath(currentDir))}
                  </Text>
                </Box>
                <Box flexDirection="row">
                  {mode === "shell" && (
                    <Box marginRight={2}>
                      <Text dimColor color="yellow">
                        (Press Esc to exit Shell Mode)
                      </Text>
                    </Box>
                  )}
                  <Text dimColor color="blue">
                    {modelName}
                  </Text>
                </Box>
              </Box>

              {suggestions.length > 0 && (
                <Box flexDirection="column" marginTop={1} paddingLeft={2} borderStyle="round" borderColor="gray" width={innerWidth}>
                  {suggestions.map((cmd, idx) => (<Box key={cmd}><Text color={idx === selectedIndex ? "cyan" : "white"} bold={idx === selectedIndex}>{idx === selectedIndex ? "→ " : "  "}/{cmd}</Text></Box>))}
                </Box>
              )}
            </Box>
          </Box>

        </>
      )}
      {config.debug && <Box marginBottom={1}><Text color="yellow">DEBUG: {t("app.debugMode")}</Text></Box>}
    </Box>
  );
}
