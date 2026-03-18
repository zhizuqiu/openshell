import React from "react";
import { Box, Text } from "ink";

export interface SuggestionsListProps {
  suggestions: string[];
  selectedIndex: number;
}

export function SuggestionsList({
  suggestions,
  selectedIndex,
}: SuggestionsListProps): React.ReactElement | null {
  if (suggestions.length === 0) return null;

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      paddingLeft={2}
      borderStyle="round"
      borderColor="gray"
      borderDimColor={true}
      width="100%"
    >
      {suggestions.map((cmd, idx) => (
        <Box key={cmd}>
          <Text
            color={idx === selectedIndex ? "cyan" : "white"}
            bold={idx === selectedIndex}
          >
            {idx === selectedIndex ? "→ " : "  "}/{cmd}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
