import React from "react";
import { Box, Text } from "ink";
import type { Interrupt } from "./types.js";
import { ChoiceView } from "./shared/index.js";
import { t } from "../i18n.js";

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

  const handleBatchDecision = (value: "approve" | "reject") => {
    const message = value === "reject" 
      ? t("hitl.rejectedFeedback")
      : undefined;
      
    const finalDecisions = actionRequests.map(() => ({
      type: value,
      message,
    }));
    onSubmit(finalDecisions);
  };

  const terminalWidth = process.stdout.columns || 80;

  if (actionRequests.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">No action requests to review</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor="yellow"
      borderDimColor={true}
      width={Math.min(terminalWidth - 4, 100)}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          {t("app.reviewRequired", { count: String(actionRequests.length) })}
        </Text>
      </Box>

      {/* 列表展示所有待审批项 */}
      <Box flexDirection="column">
        {actionRequests.map((req, i) => {
          const argsText = Object.entries(req.args)
            .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
            .join(", ");
            
          return (
            <Box key={i} flexDirection="column" marginBottom={i === actionRequests.length - 1 ? 0 : 1}>
              <Text color="white">
                {i + 1}. <Text bold>{req.name}</Text>
              </Text>
              {argsText && (
                <Box marginLeft={3}>
                  <Text dimColor wrap="wrap">
                    {argsText}
                  </Text>
                </Box>
              )}
              {req.description && (
                <Box marginLeft={3}>
                  <Text color="yellow" dimColor italic wrap="wrap">
                    {req.description}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={0} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" borderDimColor={true} />

      <Box marginTop={0}>
        <ChoiceView
          options={[
            {
              label: t("hitl.approveAllLabel"),
              value: "approve",
            },
            {
              label: t("hitl.rejectAllLabel"),
              value: "reject",
            },
          ]}
          onSelect={(val) => handleBatchDecision(val as "approve" | "reject")}
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="gray" dimColor>
          {t("app.navigateLabel")}: ↑/↓ | {t("app.confirmLabel")}: Enter | {t("app.cancelLabel")}: Esc
        </Text>
      </Box>
    </Box>
  );
};
