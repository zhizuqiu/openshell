import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export interface ChoiceOption {
  label: string;
  value: string;
  description?: string;
}

export const ChoiceView: React.FC<{
  question?: string;
  options: ChoiceOption[];
  initialValue?: string;
  onSelect: (value: string) => void;
}> = ({ question, options, initialValue, onSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(
    initialValue ? options.findIndex((opt) => opt.value === initialValue) : 0,
  );

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      return true;
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      return true;
    } else if (key.return) {
      onSelect(options[selectedIndex]!.value);
      return true;
    }
    return false;
  });

  return (
    <Box flexDirection="column">
      {question && (
        <Text bold wrap="wrap">
          {question}
        </Text>
      )}
      <Box marginTop={1} flexDirection="column">
        {options.map((opt, i) => {
          const isFocused = i === selectedIndex;
          return (
            <Box key={i} flexDirection="column">
              <Box flexDirection="row">
                <Text color={isFocused ? "cyan" : "white"}>
                  {isFocused ? "❯ " : "  "}
                  {opt.label}
                </Text>
              </Box>
              {isFocused && opt.description && (
                <Box marginLeft={4}>
                  <Text color="gray" italic wrap="wrap">
                    {opt.description}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
