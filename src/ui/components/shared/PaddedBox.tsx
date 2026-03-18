import React from "react";
import { Box, Text } from "ink";

export interface PaddedBoxProps {
  backgroundColor: string;
  terminalBackground: string;
  children: React.ReactNode;
  paddingX?: number;
  width?: number | string;
}

export function PaddedBox({
  backgroundColor,
  terminalBackground,
  children,
  paddingX = 1,
  width = "100%",
}: PaddedBoxProps): React.ReactElement {
  const termWidth =
    typeof width === "number"
      ? width
      : (process.stdout.columns || 80) - 2;

  return (
    <Box
      flexDirection="column"
      backgroundColor={backgroundColor}
      width={width}
    >
      <Box width="100%">
        <Text color={terminalBackground} backgroundColor={backgroundColor}>
          {"▀".repeat(Math.max(1, termWidth))}
        </Text>
      </Box>
      <Box flexDirection="column" paddingX={paddingX}>
        {children}
      </Box>
      <Box width="100%">
        <Text color={terminalBackground} backgroundColor={backgroundColor}>
          {"▄".repeat(Math.max(1, termWidth))}
        </Text>
      </Box>
    </Box>
  );
}