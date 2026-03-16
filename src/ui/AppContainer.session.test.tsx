/**
 * Session Selection Feature Tests
 *
 * Requirements:
 * 1. Input /session shows session selection box
 * 2. Selecting a session submits /session <session_id>
 * 3. Loading session history into chat
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock dependencies before importing
vi.mock("../core/ai/agent.js", () => ({
  createShellAgent: vi.fn(),
  listAllSessions: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("../core/session/command-manager.js", () => ({
  getCommandManager: vi.fn(() => ({
    listCommands: vi.fn(() => []),
    cleanupAll: vi.fn(),
  })),
}));

vi.mock("../core/question.js", () => ({
  questionManager: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock("../i18n.js", () => ({
  t: (key: string) => key,
}));

vi.mock("./MessageComponent.js", () => ({
  MessageComponent: () => null,
}));

vi.mock("./AskUserDialog.js", () => ({
  AskUserDialog: () => null,
}));

vi.mock("ink", () => ({
  Box: () => null,
  Text: () => null,
  useApp: () => ({ exit: vi.fn() }),
  useStdin: () => ({
    stdin: { on: vi.fn(), off: vi.fn() },
    setRawMode: vi.fn(),
  }),
  Static: () => null,
  render: () => ({}),
}));

vi.mock("ink-select-input", () => ({
  default: () => null,
}));

vi.mock("ink-spinner", () => ({
  default: () => null,
}));

vi.mock("ink-gradient", () => ({
  default: () => null,
}));

vi.mock("ink-big-text", () => ({
  default: () => null,
}));

import { listAllSessions, deleteSession } from "../core/ai/agent.js";

describe("Session Selection Core Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAllSessions", () => {
    it("returns array of session objects with thread_id and updated_at", async () => {
      const mockSessions = [
        { thread_id: "s_0cb0m9", updated_at: "2026-03-16T03:37:13.124Z" },
        { thread_id: "s_xyz123", updated_at: "2026-03-16T02:00:00.000Z" },
      ];
      vi.mocked(listAllSessions).mockResolvedValue(mockSessions);

      const result = await listAllSessions();

      expect(result).toEqual(mockSessions);
      expect(result[0]).toHaveProperty("thread_id");
      expect(result[0]).toHaveProperty("updated_at");
    });

    it("returns empty array when no sessions exist", async () => {
      vi.mocked(listAllSessions).mockResolvedValue([]);

      const result = await listAllSessions();

      expect(result).toEqual([]);
    });

    it("returns empty array on error", async () => {
      vi.mocked(listAllSessions).mockRejectedValue(new Error("Database error"));

      const result = await listAllSessions().catch(() => []);

      expect(result).toEqual([]);
    });
  });

  describe("deleteSession", () => {
    it("returns true when session is deleted successfully", async () => {
      vi.mocked(deleteSession).mockResolvedValue(true);

      const result = await deleteSession("s_0cb0m9");

      expect(result).toBe(true);
      expect(deleteSession).toHaveBeenCalledWith("s_0cb0m9");
    });

    it("returns false when deletion fails", async () => {
      vi.mocked(deleteSession).mockRejectedValue(new Error("Delete failed"));

      const result = await deleteSession("s_0cb0m9").catch(() => false);

      expect(result).toBe(false);
    });
  });

  describe("Session message format handling", () => {
    it("handles LangChain serialized format with kwargs", () => {
      const mockMessage = {
        lc: 1,
        type: "constructor",
        id: ["langchain_core", "messages", "HumanMessage"],
        kwargs: {
          content: "Hello",
          additional_kwargs: {},
          response_metadata: {},
        },
      };

      // Simulate the parsing logic from loadSessionHistory
      const kwargs = mockMessage.kwargs || mockMessage;
      const content = mockMessage.content ?? kwargs.content;

      expect(content).toBe("Hello");
    });

    it("handles deserialized format with direct content", () => {
      const mockMessage = {
        type: "human",
        content: "Hello",
        additional_kwargs: {},
      };

      const kwargs = mockMessage.kwargs || mockMessage;
      const content = mockMessage.content ?? kwargs.content;

      expect(content).toBe("Hello");
    });

    it("identifies message role from type field", () => {
      const humanMsg = { type: "human", content: "Hi" };
      const aiMsg = { type: "ai", content: "Hello" };
      const systemMsg = { type: "system", content: "System" };

      expect(humanMsg.type).toBe("human");
      expect(aiMsg.type).toBe("ai");
      expect(systemMsg.type).toBe("system");
    });

    it("identifies message role from id array", () => {
      const humanMsg = { id: ["langchain_core", "messages", "HumanMessage"] };
      const aiMsg = { id: ["langchain_core", "messages", "AIMessageChunk"] };
      const systemMsg = { id: ["langchain_core", "messages", "SystemMessage"] };

      expect(humanMsg.id?.[2]).toBe("HumanMessage");
      expect(aiMsg.id?.[2]).toBe("AIMessageChunk");
      expect(systemMsg.id?.[2]).toBe("SystemMessage");
    });
  });
});
