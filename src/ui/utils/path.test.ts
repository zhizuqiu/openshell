import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tildeifyPath, shortenPath } from "./path.js";

vi.mock("os", () => ({
  default: {
    homedir: () => "/Users/testuser",
  },
}));

describe("tildeifyPath", () => {
  it("should return ~ for home directory", () => {
    expect(tildeifyPath("/Users/testuser")).toBe("~");
  });

  it("should replace home directory prefix with ~", () => {
    expect(tildeifyPath("/Users/testuser/projects/myapp")).toBe(
      "~/projects/myapp",
    );
  });

  it("should return path unchanged if not under home", () => {
    expect(tildeifyPath("/etc/config")).toBe("/etc/config");
  });

  it("should handle empty string", () => {
    expect(tildeifyPath("")).toBe("");
  });

  it("should handle relative paths", () => {
    expect(tildeifyPath("./local/path")).toBe("./local/path");
  });
});

describe("shortenPath", () => {
  it("should return path unchanged if under max length", () => {
    expect(shortenPath("/short/path", 40)).toBe("/short/path");
  });

  it("should shorten long paths", () => {
    const longPath =
      "/Users/testuser/projects/very/deeply/nested/directory/structure/file.txt";
    const result = shortenPath(longPath, 40);
    expect(result.length).toBeLessThanOrEqual(40);
  });

  it("should handle tilde paths", () => {
    const longPath =
      "~/projects/very/deeply/nested/directory/structure/file.txt";
    const result = shortenPath(longPath, 40);
    expect(result.startsWith("~") || result.length <= 40).toBe(true);
  });

  it("should return last segment if shortened path still too long", () => {
    const longPath =
      "/very/long/path/with/extremely/long/directory/structure/that/exceeds/limit.txt";
    const result = shortenPath(longPath, 20);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it("should handle paths with 2 or fewer segments unchanged", () => {
    expect(shortenPath("/one/two", 10)).toBe("/one/two");
    expect(shortenPath("/single", 40)).toBe("/single");
  });

  it("should use default max length of 40", () => {
    const shortPath = "/short";
    expect(shortenPath(shortPath)).toBe(shortPath);
  });

  it("should handle empty string", () => {
    expect(shortenPath("")).toBe("");
  });
});
