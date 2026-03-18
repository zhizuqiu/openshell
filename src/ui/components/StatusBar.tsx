import React from "react";
import { Box, Text } from "ink";
import { t } from "../../i18n.js";

export interface StatusBarProps {
  version: string;
  sessionId: string;
  mode: "agent" | "shell";
  runningCommands: number;
  autoExecute: boolean;
}

export function StatusBar({
  version,
  sessionId,
  mode,
  runningCommands,
  autoExecute,
}: StatusBarProps): React.ReactElement {
  return (
    <Box flexDirection="row" justifyContent="space-between" width="100%">
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Text bold color="cyan">
          OpenShell {version}
        </Text>
        <Text dimColor>|</Text>
        <Text dimColor>Session: {sessionId}</Text>
        <Text dimColor>|</Text>
        <Text bold color={mode === "shell" ? "green" : "cyan"}>
          [{mode === "shell" ? "Shell" : "Agent"}]
        </Text>
      </Box>
      <Box flexDirection="row" gap={2}>
        <Text color="magenta">
          {t("status.runningLabel")}: {runningCommands} |
        </Text>
        <Text color="magenta">
          {t("status.autoExecuteLabel")}(Ctrl+A): {autoExecute ? "✓" : "✗"}
        </Text>
      </Box>
    </Box>
  );
}
