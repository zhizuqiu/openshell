import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { useInputState } from "./useInputState.js";

function TestComponent({
  testFn,
}: {
  testFn: (hook: ReturnType<typeof useInputState>) => void;
}) {
  const hook = useInputState();
  testFn(hook);
  return null;
}

describe("useInputState", () => {
  it("should initialize with empty input and cursor at 0", () => {
    let result: ReturnType<typeof useInputState> | null = null;
    render(
      <TestComponent
        testFn={(hook) => {
          result = hook;
        }}
      />,
    );
    expect(result?.inputValue).toBe("");
    expect(result?.cursorPosition).toBe(0);
  });

  it("should have refs initialized correctly", () => {
    let result: ReturnType<typeof useInputState> | null = null;
    render(
      <TestComponent
        testFn={(hook) => {
          result = hook;
        }}
      />,
    );
    expect(result?.inputValueRef.current).toBe("");
    expect(result?.cursorRef.current).toBe(0);
    expect(result?.isPastingRef.current).toBe(false);
    expect(result?.lastPasteEndRef.current).toBe(0);
    expect(result?.pasteBufferRef.current).toBe("");
  });

  it("should have resetInput function", () => {
    let result: ReturnType<typeof useInputState> | null = null;
    render(
      <TestComponent
        testFn={(hook) => {
          result = hook;
        }}
      />,
    );
    expect(typeof result?.resetInput).toBe("function");
  });
});
