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

  const borderColor = isProcessing
    ? colors.promptProcessing
    : mode === "shell"
      ? colors.promptShell
      : colors.promptAgent;

  const promptColor = isProcessing
    ? colors.promptProcessing
    : mode === "shell"
      ? colors.promptShell
      : colors.promptAgent;

  const prompt = mode === "shell" ? "! " : "> ";

  return (
    <Box
      flexDirection="row"
      paddingX={1}
      borderStyle="round"
      borderColor={borderColor}
      borderDimColor={true}
      backgroundColor={colors.inputBackground}
      alignItems="flex-start"
      width="100%"
    >
      <Text color={promptColor} bold>
        {prompt}
      </Text>
      <Box flexGrow={1}>
        {isProcessing ? (
          inputValue ? (
            <Text dimColor wrap="wrap">
              {inputValue}
            </Text>
          ) : (
            <Box flexDirection="row">
              <Text color="yellow">
                <Spinner type="dots" />
              </Text>
              <Text dimColor> Processing...</Text>
            </Box>
          )
        ) : inputValue.length === 0 ? (
          <Text color="#888888">{placeholder}</Text>
        ) : (
          <Text wrap="wrap">
            <Text>{inputValue.slice(0, cursorPosition)}</Text>
            <Text inverse>{inputValue[cursorPosition] || " "}</Text>
            <Text>{inputValue.slice(cursorPosition + 1)}</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
}
