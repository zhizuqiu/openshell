import { describe, it, expect, vi } from "vitest";
import React from "react";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { SessionSelector } from "./SessionSelector.js";

vi.mock("ink-select-input", () => ({
  default: ({ items }: { items: { label: string; value: string }[] }) => (
    <Text>{items.map((item) => item.label).join(", ")}</Text>
  ),
}));

describe("SessionSelector", () => {
  it("should render session list", () => {
    const sessions = [
      { label: "session-1 (Today)", value: "session-1" },
      { label: "session-2 (Yesterday)", value: "session-2" },
    ];
    const { lastFrame } = render(
      <SessionSelector sessions={sessions} onSelect={() => {}} />,
    );
    expect(lastFrame()).toContain("Select a session to restore:");
  });

  it("should show empty message when no sessions", () => {
    const { lastFrame } = render(
      <SessionSelector sessions={[]} onSelect={() => {}} />,
    );
    expect(lastFrame()).toContain("No historical sessions found.");
  });

  it("should show navigation hints", () => {
    const { lastFrame } = render(
      <SessionSelector
        sessions={[{ label: "test", value: "test" }]}
        onSelect={() => {}}
      />,
    );
    expect(lastFrame()).toContain("Navigate:");
    expect(lastFrame()).toContain("Cancel: ESC");
  });
});
