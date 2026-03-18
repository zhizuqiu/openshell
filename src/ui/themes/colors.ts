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
  inputBackground: "#5F5F5F",
  userMessageBackground: "#3a3a3a",
  inputBorder: "#4a4a4a",
  promptAgent: "#87AFFF",
  promptShell: "#D7FFD7",
  promptProcessing: "#878787",
};

export const LIGHT_THEME: ThemeColors = {
  terminalBackground: "#FFFFFF",
  inputBackground: "#E4E4E4",
  userMessageBackground: "#D8D8D8",
  inputBorder: "#D0D0D0",
  promptAgent: "#005FAF",
  promptShell: "#005F00",
  promptProcessing: "#878787",
};