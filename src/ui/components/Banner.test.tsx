import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { Banner } from "./Banner.js";

vi.mock("ink-big-text", () => ({
  default: ({ text }: { text: string }) =>
    React.createElement(Text, null, text),
}));

vi.mock("ink-gradient", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("ink-gradient", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Banner", () => {
  it("should render banner when showBanner is true", () => {
    const { lastFrame } = render(<Banner showBanner={true} version="1.0.0" />);
    expect(lastFrame()).toContain("OpenShell");
  });

  it("should render shortcuts even when showBanner is false", () => {
    const { lastFrame } = render(<Banner showBanner={false} version="1.0.0" />);
    expect(lastFrame()).toContain("Enter");
    expect(lastFrame()).toContain("Esc");
    expect(lastFrame()).toContain("Ctrl+A");
  });

  it("should render all keyboard shortcuts", () => {
    const { lastFrame } = render(<Banner showBanner={true} version="1.0.0" />);
    const output = lastFrame();
    expect(output).toContain("Enter");
    expect(output).toContain("Esc");
    expect(output).toContain("Ctrl+A");
    expect(output).toContain("Ctrl+C");
  });
});
