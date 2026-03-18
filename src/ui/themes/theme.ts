import { DARK_THEME, LIGHT_THEME, type ThemeColors } from "./colors.js";
import {
  getTerminalBackground,
  getTerminalBackgroundHex,
  type TerminalBackground,
} from "../../core/terminal/index.js";

let detectedBackground: TerminalBackground | null = null;

export function setDetectedBackground(bg: TerminalBackground | null): void {
  detectedBackground = bg;
}

export function getTheme(): "dark" | "light" {
  if (detectedBackground) {
    return detectedBackground;
  }
  return getTerminalBackground();
}

export function getThemeColors(): ThemeColors {
  const theme = getTheme();
  const colors = theme === "light" ? LIGHT_THEME : DARK_THEME;

  const terminalBg = getTerminalBackgroundHex();

  return {
    ...colors,
    terminalBackground: terminalBg,
  };
}