import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { Interrupt } from "./types.js";
import { TabHeader, ChoiceView, ReviewView } from "./shared/index.js";

export interface ToolApprovalRequest {
  name: string;
  args: Record<string, any>;
  description?: string;
}

export interface ToolApprovalDialogProps {
  interrupt: Interrupt;
  onSubmit: (
    decisions: { type: "approve" | "reject"; message?: string }[],
  ) => void;
  onCancel: () => void;
}

export const ToolApprovalDialog: React.FC<ToolApprovalDialogProps> = ({
  interrupt,
  onSubmit,
  onCancel,
}) => {
  const actionRequests: ToolApprovalRequest[] =
    interrupt.value?.actionRequests || interrupt.value?.action_requests || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<
    Map<number, { type: "approve" | "reject"; message?: string }>
  >(new Map());

  const answeredIndices = useMemo(() => new Set(decisions.keys()), [decisions]);
  const isReviewMode = currentIndex === actionRequests.length;

  const handleSelect = (value: "approve" | "reject") => {
    setDecisions((prev) => new Map(prev).set(currentIndex, { type: value }));

    if (actionRequests.length > 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // 只有一个审批项，直接提交
      const finalDecisions = actionRequests.map((_, i) => ({
        type: i === currentIndex ? value : "approve",
      }));
      onSubmit(finalDecisions);
    }
  };

  const handleFinalSubmit = () => {
    const finalDecisions = actionRequests.map(
      (_, i) => decisions.get(i) || { type: "approve" as const },
    );
    onSubmit(finalDecisions);
  };

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return true;
    } else if (key.leftArrow) {
      if (currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
        return true;
      }
    } else if (key.rightArrow) {
      if (
        currentIndex < actionRequests.length &&
        (answeredIndices.has(currentIndex) ||
          currentIndex < actionRequests.length - 1)
      ) {
        setCurrentIndex((prev) => prev + 1);
        return true;
      }
    } else if (key.tab && !key.shift) {
      if (
        currentIndex < actionRequests.length &&
        (answeredIndices.has(currentIndex) ||
          currentIndex < actionRequests.length - 1)
      ) {
        setCurrentIndex((prev) => prev + 1);
        return true;
      }
    } else if (key.tab && key.shift) {
      if (currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
        return true;
      }
    }
    return false;
  });

  const terminalWidth = process.stdout.columns || 80;

  if (isReviewMode) {
    const reviewItems: Array<{
      header: string;
      value: string;
      status?: "approved" | "rejected" | "pending";
    }> = actionRequests.map((req, i) => {
      const decision = decisions.get(i);
      return {
        header: `${i + 1}. ${req.name}`,
        value: decision?.type || "pending",
        status:
          decision?.type === "approve"
            ? "approved"
            : decision?.type === "reject"
              ? "rejected"
              : "pending",
      };
    });

    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="yellow"
        borderDimColor={true}
        width={Math.min(terminalWidth - 4, 100)}
      >
        <TabHeader
          items={actionRequests.map((req) => ({ header: req.name }))}
          currentIndex={currentIndex}
          answeredIndices={answeredIndices}
          showReview={true}
        />
        <ReviewView items={reviewItems} onSubmit={handleFinalSubmit} />
        <Box marginTop={1} flexDirection="column">
          <Text color="gray" dimColor>
            ←/→/Tab: Navigate | Esc: Cancel
          </Text>
          <Text color="cyan" bold>
            Press Enter to submit all decisions
          </Text>
        </Box>
      </Box>
    );
  }

  const currentRequest = actionRequests[currentIndex];
  if (!currentRequest) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">No action requests to review</Text>
      </Box>
    );
  }

  const argsText = Object.entries(currentRequest.args)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ");

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor="yellow"
      borderDimColor={true}
      width={Math.min(terminalWidth - 4, 100)}
    >
      <TabHeader
        items={actionRequests.map((req) => ({ header: req.name }))}
        currentIndex={currentIndex}
        answeredIndices={answeredIndices}
        showReview={actionRequests.length > 1}
      />

      <Box flexDirection="column" marginTop={1}>
        <Text bold color="yellow" wrap="wrap">
          {currentIndex + 1}. {currentRequest.name}
        </Text>
        {argsText && (
          <Box marginTop={1}>
            <Text dimColor wrap="wrap">
              {argsText}
            </Text>
          </Box>
        )}
        {currentRequest.description && (
          <Box marginTop={1}>
            <Text color="yellow" dimColor wrap="wrap">
              {currentRequest.description}
            </Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <ChoiceView
          options={[
            {
              label: "Approve",
              value: "approve",
              description: "Execute this action",
            },
            {
              label: "Reject",
              value: "reject",
              description: "Cancel this action",
            },
          ]}
          onSelect={(val) => handleSelect(val as "approve" | "reject")}
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="gray" dimColor>
          {currentIndex > 0 ? "←/Shift+Tab: Prev | " : ""}
          {answeredIndices.has(currentIndex) ||
          currentIndex < actionRequests.length - 1
            ? "→/Tab: Next | "
            : ""}
          Esc: Cancel
        </Text>
        <Text color="cyan" bold>
          Press Enter to {decisions.has(currentIndex) ? "change" : "confirm"}{" "}
          {decisions.has(currentIndex)
            ? decisions.get(currentIndex)?.type
            : "selection"}
        </Text>
      </Box>
    </Box>
  );
};
