import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { useCommandHistory } from "./useCommandHistory.js";

function TestComponent({
  onMount,
}: {
  onMount: (hook: ReturnType<typeof useCommandHistory>) => void;
}) {
  const hook = useCommandHistory();
  React.useEffect(() => {
    onMount(hook);
  }, []);
  return null;
}

describe("useCommandHistory", () => {
  it("should initialize with addCommand, navigateUp, navigateDown functions", () => {
    let hook: ReturnType<typeof useCommandHistory> | undefined;
    render(<TestComponent onMount={(h) => (hook = h)} />);
    expect(typeof hook?.addCommand).toBe("function");
    expect(typeof hook?.navigateUp).toBe("function");
    expect(typeof hook?.navigateDown).toBe("function");
  });

  it("should return null when navigating up with empty history", () => {
    let hook: ReturnType<typeof useCommandHistory> | undefined;
    render(<TestComponent onMount={(h) => (hook = h)} />);
    expect(hook?.navigateUp("agent", "test")).toBeNull();
  });

  it("should add command and navigate up", () => {
    let hook: ReturnType<typeof useCommandHistory> | undefined;
    render(<TestComponent onMount={(h) => (hook = h)} />);
    hook!.addCommand("ls -la", "agent");
    expect(hook?.navigateUp("agent", "")).toBe("ls -la");
  });

  it("should navigate through multiple commands", () => {
    let hook: ReturnType<typeof useCommandHistory> | undefined;
    render(<TestComponent onMount={(h) => (hook = h)} />);
    hook!.addCommand("first", "agent");
    hook!.addCommand("second", "agent");
    expect(hook?.navigateUp("agent", "")).toBe("second");
    expect(hook?.navigateUp("agent", "")).toBe("first");
  });

  it("should navigate down and return to draft", () => {
    let hook: ReturnType<typeof useCommandHistory> | undefined;
    render(<TestComponent onMount={(h) => (hook = h)} />);
    hook!.addCommand("command", "agent");
    hook!.navigateUp("agent", "draft");
    expect(hook?.navigateDown("agent")).toBe("draft");
  });

  it("should maintain separate histories for agent and shell modes", () => {
    let hook: ReturnType<typeof useCommandHistory> | undefined;
    render(<TestComponent onMount={(h) => (hook = h)} />);
    hook!.addCommand("agent command", "agent");
    hook!.addCommand("shell command", "shell");
    expect(hook?.navigateUp("agent", "")).toBe("agent command");
    expect(hook?.navigateUp("shell", "")).toBe("shell command");
  });
});
