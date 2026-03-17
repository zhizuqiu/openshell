import React from "react";
import { Box, Text } from "ink";

export interface TabHeaderItem {
  header: string;
}

export const TabHeader: React.FC<{
  items: TabHeaderItem[];
  currentIndex: number;
  answeredIndices: Set<number>;
  showReview?: boolean;
}> = ({ items, currentIndex, answeredIndices, showReview = false }) => {
  return (
    <Box marginBottom={1} flexDirection="row" flexWrap="wrap">
      {items.map((item, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = answeredIndices.has(i);
        return (
          <Box key={i} marginRight={2}>
            <Text
              bold={isCurrent}
              color={isCurrent ? "cyan" : isAnswered ? "green" : "gray"}
              underline={isCurrent}
            >
              {isAnswered ? "✓ " : ""}
              {i + 1}. {item.header}
            </Text>
          </Box>
        );
      })}
      {showReview && items.length > 1 && (
        <Box key="review" marginLeft={2}>
          <Text
            bold={currentIndex === items.length}
            color={currentIndex === items.length ? "cyan" : "gray"}
            underline={currentIndex === items.length}
          >
            ✓ Review
          </Text>
        </Box>
      )}
    </Box>
  );
};
