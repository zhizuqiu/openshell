import { describe, it, expect, vi } from "vitest";
import React from "react";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { LoadingIndicator } from "./LoadingIndicator.js";

vi.mock("ink-spinner", () => ({
  default: () => React.createElement(Text, null, "..."),
}));

describe("LoadingIndicator", () => {
  it("should render default message", () => {
    const { lastFrame } = render(<LoadingIndicator />);
    expect(lastFrame()).toContain("Initializing...");
  });

  it("should render custom message", () => {
    const { lastFrame } = render(
      <LoadingIndicator message="Loading data..." />,
    );
    expect(lastFrame()).toContain("Loading data...");
  });
});
