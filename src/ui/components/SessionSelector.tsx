import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

export interface SessionItem {
  label: string;
  value: string;
}

export interface SessionSelectorProps {
  sessions: SessionItem[];
  onSelect: (sessionId: string) => void;
}

export function SessionSelector({
  sessions,
  onSelect,
}: SessionSelectorProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor="cyan"
      borderDimColor={true}
      width="100%"
    >
      <Text bold color="cyan">
        Select a session to restore:
      </Text>
      <Box marginTop={1}>
        {sessions.length > 0 ? (
          <SelectInput
            items={sessions}
            onSelect={(item) => onSelect(item.value)}
          />
        ) : (
          <Text dimColor>No historical sessions found.</Text>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor color="gray">
          Navigate: ↑/↓ | Resume: Enter | Delete: x | Cancel: ESC
        </Text>
      </Box>
    </Box>
  );
}
