import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { StatusBar } from "./StatusBar.js";

describe("StatusBar", () => {
  it("should render version", () => {
    const { lastFrame } = render(
      <StatusBar
        version="1.0.0"
        sessionId="test-session"
        mode="agent"
        runningCommands={0}
        autoExecute={false}
      />,
    );
    expect(lastFrame()).toContain("OpenShell 1.0.0");
  });

  it("should render session id", () => {
    const { lastFrame } = render(
      <StatusBar
        version="1.0.0"
        sessionId="my-session"
        mode="agent"
        runningCommands={0}
        autoExecute={false}
      />,
    );
    expect(lastFrame()).toContain("Session: my-session");
  });

  it("should render agent mode", () => {
    const { lastFrame } = render(
      <StatusBar
        version="1.0.0"
        sessionId="test"
        mode="agent"
        runningCommands={0}
        autoExecute={false}
      />,
    );
    expect(lastFrame()).toContain("[Agent]");
  });

  it("should render shell mode", () => {
    const { lastFrame } = render(
      <StatusBar
        version="1.0.0"
        sessionId="test"
        mode="shell"
        runningCommands={0}
        autoExecute={false}
      />,
    );
    expect(lastFrame()).toContain("[Shell]");
  });

  it("should render running commands count", () => {
    const { lastFrame } = render(
      <StatusBar
        version="1.0.0"
        sessionId="test"
        mode="agent"
        runningCommands={3}
        autoExecute={false}
      />,
    );
    expect(lastFrame()).toContain("3");
  });

  it("should render autoExecute enabled", () => {
    const { lastFrame } = render(
      <StatusBar
        version="1.0.0"
        sessionId="test"
        mode="agent"
        runningCommands={0}
        autoExecute={true}
      />,
    );
    expect(lastFrame()).toContain("✓");
  });

  it("should render autoExecute disabled", () => {
    const { lastFrame } = render(
      <StatusBar
        version="1.0.0"
        sessionId="test"
        mode="agent"
        runningCommands={0}
        autoExecute={false}
      />,
    );
    expect(lastFrame()).toContain("✗");
  });
});
