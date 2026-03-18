import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { DebugIndicator } from "./DebugIndicator.js";

describe("DebugIndicator", () => {
  it("should render when visible is true", () => {
    const { lastFrame } = render(<DebugIndicator visible={true} />);
    expect(lastFrame()).toContain("DEBUG:");
  });

  it("should not render when visible is false", () => {
    const { lastFrame } = render(<DebugIndicator visible={false} />);
    expect(lastFrame()).toBe("");
  });
});
