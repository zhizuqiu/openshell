import { useRef, useCallback } from "react";

export interface UseCommandHistoryReturn {
  addCommand: (command: string, mode: "agent" | "shell") => void;
  navigateUp: (mode: "agent" | "shell", currentInput: string) => string | null;
  navigateDown: (mode: "agent" | "shell") => string | null;
}

export function useCommandHistory(): UseCommandHistoryReturn {
  const commandHistoryRef = useRef<string[]>([]);
  const shellHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef<{ agent: number; shell: number }>({
    agent: -1,
    shell: -1,
  });
  const draftInputRef = useRef<{ agent: string; shell: string }>({
    agent: "",
    shell: "",
  });

  const addCommand = useCallback((command: string, mode: "agent" | "shell") => {
    const history =
      mode === "shell" ? shellHistoryRef.current : commandHistoryRef.current;
    history.push(command);
    historyIndexRef.current[mode] = -1;
  }, []);

  const navigateUp = useCallback(
    (mode: "agent" | "shell", currentInput: string): string | null => {
      const history =
        mode === "shell" ? shellHistoryRef.current : commandHistoryRef.current;
      if (history.length === 0) return null;

      if (historyIndexRef.current[mode] === -1) {
        draftInputRef.current[mode] = currentInput;
        historyIndexRef.current[mode] = history.length - 1;
      } else if (historyIndexRef.current[mode] > 0) {
        historyIndexRef.current[mode] -= 1;
      } else {
        return null;
      }

      return history[historyIndexRef.current[mode]] ?? null;
    },
    [],
  );

  const navigateDown = useCallback((mode: "agent" | "shell"): string | null => {
    const history =
      mode === "shell" ? shellHistoryRef.current : commandHistoryRef.current;
    if (historyIndexRef.current[mode] === -1) return null;

    if (historyIndexRef.current[mode] < history.length - 1) {
      historyIndexRef.current[mode] += 1;
      return history[historyIndexRef.current[mode]] ?? null;
    } else {
      historyIndexRef.current[mode] = -1;
      const draft = draftInputRef.current[mode];
      draftInputRef.current[mode] = "";
      return draft;
    }
  }, []);

  return {
    addCommand,
    navigateUp,
    navigateDown,
  };
}
