import React from "react";
import { Box, Text } from "ink";
import { tildeifyPath, shortenPath } from "../utils/path.js";

export interface FooterBarProps {
  currentDir: string;
  modelName: string;
  mode: "agent" | "shell";
}

export function FooterBar({
  currentDir,
  modelName,
  mode,
}: FooterBarProps): React.ReactElement {
  return (
    <Box
      paddingX={2}
      marginTop={0}
      marginBottom={1}
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
    >
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
  );
}
