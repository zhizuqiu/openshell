import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

export interface LoadingIndicatorProps {
  message?: string;
}

export function LoadingIndicator({
  message = "Initializing...",
}: LoadingIndicatorProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Spinner type="dots" />
        <Text>{message}</Text>
      </Box>
    </Box>
  );
}
