import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { SuggestionsList } from "./SuggestionsList.js";

describe("SuggestionsList", () => {
  it("should return null when suggestions is empty", () => {
    const { lastFrame } = render(
      <SuggestionsList suggestions={[]} selectedIndex={0} />,
    );
    expect(lastFrame()).toBe("");
  });

  it("should render suggestions", () => {
    const { lastFrame } = render(
      <SuggestionsList
        suggestions={["help", "exit", "version"]}
        selectedIndex={0}
      />,
    );
    expect(lastFrame()).toContain("/help");
    expect(lastFrame()).toContain("/exit");
    expect(lastFrame()).toContain("/version");
  });

  it("should highlight selected item", () => {
    const { lastFrame } = render(
      <SuggestionsList
        suggestions={["help", "exit", "version"]}
        selectedIndex={1}
      />,
    );
    expect(lastFrame()).toContain("→ /exit");
  });

  it("should show arrow for first item when selected", () => {
    const { lastFrame } = render(
      <SuggestionsList suggestions={["help", "exit"]} selectedIndex={0} />,
    );
    expect(lastFrame()).toContain("→ /help");
  });
});
