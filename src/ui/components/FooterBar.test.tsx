import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { FooterBar } from "./FooterBar.js";

vi.mock("../utils/path.js", () => ({
  tildeifyPath: (p: string) => (p.startsWith("/home") ? `~${p.slice(5)}` : p),
  shortenPath: (p: string) => (p.length > 40 ? "..." : p),
}));

describe("FooterBar", () => {
  it("should render current directory", () => {
    const { lastFrame } = render(
      <FooterBar
        currentDir="/home/user/project"
        modelName="gpt-4o"
        mode="agent"
      />,
    );
    expect(lastFrame()).toContain("project");
  });

  it("should render model name", () => {
    const { lastFrame } = render(
      <FooterBar currentDir="/tmp" modelName="gpt-4o" mode="agent" />,
    );
    expect(lastFrame()).toContain("gpt-4o");
  });

  it("should show shell mode hint when in shell mode", () => {
    const { lastFrame } = render(
      <FooterBar currentDir="/tmp" modelName="gpt-4o" mode="shell" />,
    );
    expect(lastFrame()).toContain("Press Esc to exit Shell Mode");
  });

  it("should not show shell mode hint in agent mode", () => {
    const { lastFrame } = render(
      <FooterBar currentDir="/tmp" modelName="gpt-4o" mode="agent" />,
    );
    expect(lastFrame()).not.toContain("Press Esc to exit");
  });
});
