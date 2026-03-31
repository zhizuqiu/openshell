import React from "react";
import { Box, Text, Static } from "ink";
import Gradient from "ink-gradient";
import BigText from "ink-big-text";
import { t } from "../../i18n.js";

export interface BannerProps {
  showBanner: boolean;
  version: string;
}

export function Banner({ showBanner }: BannerProps): React.ReactElement {
  return (
    <Static items={["banner"]} key="brand-banner">
      {(item) => (
        <Box
          key={item}
          marginBottom={1}
          flexDirection="column"
          alignItems="center"
          width="100%"
        >
          {showBanner && (
            <Gradient name="morning">
              <BigText text="OpenShell" font="block" />
            </Gradient>
          )}
          <Box marginTop={showBanner ? 1 : 0} flexDirection="row" gap={2}>
            <Box flexDirection="row" gap={1}>
              <Text color="cyan" bold>
                Enter
              </Text>
              <Text dimColor>{t("shortcuts.sendLabel")}</Text>
            </Box>
            <Text dimColor>|</Text>
            <Box flexDirection="row" gap={1}>
              <Text color="cyan" bold>
                Esc
              </Text>
              <Text dimColor>{t("shortcuts.cancelLabel")}</Text>
            </Box>
            <Text dimColor>|</Text>
            <Box flexDirection="row" gap={1}>
              <Text color="cyan" bold>
                Ctrl+A
              </Text>
              <Text dimColor>{t("status.autoExecuteLabel")}</Text>
            </Box>
            <Text dimColor>|</Text>
            <Box flexDirection="row" gap={1}>
              <Text color="cyan" bold>
                ↑/↓
              </Text>
              <Text dimColor>{t("shortcuts.historyLabel")}</Text>
            </Box>
            <Text dimColor>|</Text>
            <Box flexDirection="row" gap={1}>
              <Text color="cyan" bold>
                Ctrl+C
              </Text>
              <Text dimColor>{t("shortcuts.exitLabel")}</Text>
            </Box>
          </Box>
        </Box>
      )}
    </Static>
  );
}
