import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { getThemeColors } from "../themes/index.js";

export interface InputBoxProps {
  mode: "agent" | "shell";
  isProcessing: boolean;
  inputValue: string;
  cursorPosition: number;
  placeholder?: string;
}

export function InputBox({
  mode,
  isProcessing,
  inputValue,
  cursorPosition,
  placeholder = "Type message, ! for shell, / for commands",
}: InputBoxProps): React.ReactElement {
  const colors = getThemeColors();

  const promptColor = isProcessing
    ? colors.promptProcessing
    : mode === "shell"
      ? colors.promptShell
      : colors.promptAgent;

  const prompt = mode === "shell" ? "! " : "> ";

  const termWidth = (process.stdout.columns || 80) - 2;

  return (
    <Box
      flexDirection="column"
      backgroundColor={colors.inputBackground}
      width="100%"
    >
      <Box width="100%" backgroundColor={colors.inputBackground}>
        <Text
          color={colors.terminalBackground}
          backgroundColor={colors.inputBackground}
        >
          {"▀".repeat(Math.max(1, termWidth))}
        </Text>
      </Box>
      <Box flexDirection="row" paddingX={1} alignItems="flex-start" backgroundColor={colors.inputBackground}>
        <Text color={promptColor} bold backgroundColor={colors.inputBackground}>
          {prompt}
        </Text>
        <Box flexGrow={1} backgroundColor={colors.inputBackground}>
          {isProcessing ? (
            inputValue ? (
              <Text dimColor wrap="wrap" backgroundColor={colors.inputBackground}>
                {inputValue}
              </Text>
            ) : (
              <Box flexDirection="row" backgroundColor={colors.inputBackground}>
                <Text color="yellow">
                  <Spinner type="dots" />
                </Text>
                <Text dimColor> Processing...</Text>
              </Box>
            )
          ) : inputValue.length === 0 ? (
            <Text color="#888888" backgroundColor={colors.inputBackground}>
              {placeholder}
            </Text>
          ) : (
            <Text wrap="wrap" backgroundColor={colors.inputBackground}>
              <Text backgroundColor={colors.inputBackground}>
                {inputValue.slice(0, cursorPosition)}
              </Text>
              <Text inverse backgroundColor={colors.inputBackground}>
                {inputValue[cursorPosition] || " "}
              </Text>
              <Text backgroundColor={colors.inputBackground}>
                {inputValue.slice(cursorPosition + 1)}
              </Text>
            </Text>
          )}
        </Box>
      </Box>
      <Box width="100%" backgroundColor={colors.inputBackground}>
        <Text
          color={colors.terminalBackground}
          backgroundColor={colors.inputBackground}
        >
          {"▄".repeat(Math.max(1, termWidth))}
        </Text>
      </Box>
    </Box>
  );
}