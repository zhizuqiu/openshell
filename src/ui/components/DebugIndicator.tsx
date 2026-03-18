import React from "react";
import { Box, Text } from "ink";
import { t } from "../../i18n.js";

export interface DebugIndicatorProps {
  visible: boolean;
}

export function DebugIndicator({
  visible,
}: DebugIndicatorProps): React.ReactElement | null {
  if (!visible) return null;

  return (
    <Box marginBottom={1}>
      <Text color="yellow">DEBUG: {t("app.debugMode")}</Text>
    </Box>
  );
}
