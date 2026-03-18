import { DARK_THEME, LIGHT_THEME, type ThemeColors } from "./colors.js";
import {
  getTerminalBackground,
  getTerminalBackgroundHex,
  type TerminalBackground,
} from "../../core/terminal/index.js";

export type ThemeType = "dark" | "light" | "auto";

let currentTheme: ThemeType = "auto";
let detectedBackground: TerminalBackground | null = null;

export function setDetectedBackground(bg: TerminalBackground | null): void {
  detectedBackground = bg;
}

export function getTheme(): "dark" | "light" {
  if (currentTheme === "auto") {
    if (detectedBackground) {
      return detectedBackground;
    }
    return getTerminalBackground();
  }
  return currentTheme;
}

export function setTheme(theme: ThemeType): void {
  currentTheme = theme;
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