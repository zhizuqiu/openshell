import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { InputBox } from "./InputBox.js";

vi.mock("ink-spinner", () => ({
  default: () => React.createElement(Text, null, "..."),
}));

vi.mock("../themes/index.js", () => ({
  getThemeColors: () => ({
    inputBackground: "#5F5F5F",
    inputBorder: "#4a4a4a",
    promptAgent: "#87AFFF",
    promptShell: "#D7FFD7",
    promptProcessing: "#878787",
  }),
}));

describe("InputBox", () => {
  it("should render placeholder when input is empty", () => {
    const { lastFrame } = render(
      <InputBox
        mode="agent"
        isProcessing={false}
        inputValue=""
        cursorPosition={0}
      />,
    );
    expect(lastFrame()).toContain("❯");
  });

  it("should not render custom placeholder inside input box", () => {
    const { lastFrame } = render(
      <InputBox
        mode="agent"
        isProcessing={false}
        inputValue=""
        cursorPosition={0}
        placeholder="Custom placeholder"
      />,
    );
    expect(lastFrame()).not.toContain("Custom placeholder");
  });

  it("should render input value", () => {
    const { lastFrame } = render(
      <InputBox
        mode="agent"
        isProcessing={false}
        inputValue="hello world"
        cursorPosition={5}
      />,
    );
    expect(lastFrame()).toContain("hello");
  });

  it("should render agent mode prompt", () => {
    const { lastFrame } = render(
      <InputBox
        mode="agent"
        isProcessing={false}
        inputValue=""
        cursorPosition={0}
      />,
    );
    expect(lastFrame()).toContain("❯");
  });

  it("should render shell mode prompt", () => {
    const { lastFrame } = render(
      <InputBox
        mode="shell"
        isProcessing={false}
        inputValue=""
        cursorPosition={0}
      />,
    );
    expect(lastFrame()).toContain("!");
  });

  it("should show processing spinner when isProcessing and no input", () => {
    const { lastFrame } = render(
      <InputBox
        mode="agent"
        isProcessing={true}
        inputValue=""
        cursorPosition={0}
      />,
    );
    expect(lastFrame()).toContain("Processing");
  });

  it("should show dimmed input when processing with input", () => {
    const { lastFrame } = render(
      <InputBox
        mode="agent"
        isProcessing={true}
        inputValue="test command"
        cursorPosition={12}
      />,
    );
    expect(lastFrame()).toContain("test command");
  });
});
