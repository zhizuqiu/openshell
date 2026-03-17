import React from "react";
import { Box, Text, useInput } from "ink";

export interface ReviewItem {
  header: string;
  value: string;
  status?: "approved" | "rejected" | "pending";
}

export const ReviewView: React.FC<{
  items: ReviewItem[];
  onSubmit: () => void;
}> = ({ items, onSubmit }) => {
  useInput((input, key) => {
    if (key.return) {
      onSubmit();
      return true;
    }
    return false;
  });

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        Review your decisions:
      </Text>
      <Box marginTop={1} flexDirection="column">
        {items.map((item, i) => {
          const statusColor =
            item.status === "approved"
              ? "green"
              : item.status === "rejected"
                ? "red"
                : "red";
          const statusText =
            item.status === "approved"
              ? "Approve"
              : item.status === "rejected"
                ? "Reject"
                : "(not selected)";
          return (
            <Box key={i} marginBottom={1}>
              <Text color="gray" dimColor wrap="wrap">
                {item.header}:{" "}
              </Text>
              <Text color={statusColor} bold>
                {statusText}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
