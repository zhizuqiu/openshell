import { DARK_THEME, LIGHT_THEME, type ThemeColors } from "./colors.js";

export type ThemeType = "dark" | "light";

let currentTheme: ThemeType = "dark";

export function getTheme(): ThemeType {
  const envTheme = process.env["OPENSHELL_THEME"];
  if (envTheme === "light" || envTheme === "dark") {
    return envTheme;
  }
  return currentTheme;
}

export function setTheme(theme: ThemeType): void {
  currentTheme = theme;
}

export function getThemeColors(): ThemeColors {
  const theme = getTheme();
  return theme === "light" ? LIGHT_THEME : DARK_THEME;
}
