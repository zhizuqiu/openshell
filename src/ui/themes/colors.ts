export interface ThemeColors {
  terminalBackground: string;
  inputBackground: string;
  userMessageBackground: string;
  inputBorder: string;
  promptAgent: string;
  promptShell: string;
  promptProcessing: string;
}

export const DARK_THEME: ThemeColors = {
  terminalBackground: "#000000",
  inputBackground: "#000000",
  userMessageBackground: "#1f1f1f",
  inputBorder: "#626262",
  promptAgent: "#d4d4d4",
  promptShell: "#7fb685",
  promptProcessing: "#6f6f6f",
};

export const LIGHT_THEME: ThemeColors = {
  terminalBackground: "#FFFFFF",
  inputBackground: "#FFFFFF",
  userMessageBackground: "#efefec",
  inputBorder: "#a8a8a3",
  promptAgent: "#3f3f3a",
  promptShell: "#3b6b41",
  promptProcessing: "#8d8d88",
};
