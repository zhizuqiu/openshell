import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface ApprovalOption {
  label: string;
  value: "approve" | "reject";
}

export const ToolApprovalInput: React.FC<{
  items: ApprovalOption[];
  onSelect: (item: ApprovalOption) => void;
}> = ({ items, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      return true;
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      return true;
    } else if (key.return) {
      onSelect(items[selectedIndex]!);
      return true;
    } else if (input === "a" || input === "A") {
      const approveItem = items.find((i) => i.value === "approve");
      if (approveItem) onSelect(approveItem);
      return true;
    } else if (input === "r" || input === "R") {
      const rejectItem = items.find((i) => i.value === "reject");
      if (rejectItem) onSelect(rejectItem);
      return true;
    }
    return false;
  });

  return (
    <Box flexDirection="column">
      {items.map((opt, i) => {
        const isFocused = i === selectedIndex;

        return (
          <Box key={i} flexDirection="row">
            <Text color={isFocused ? "cyan" : "white"}>
              {isFocused ? "❯ " : "  "}
            </Text>
            <Text
              color={
                opt.value === "approve"
                  ? isFocused
                    ? "green"
                    : "green"
                  : isFocused
                    ? "red"
                    : "red"
              }
            >
              {opt.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
