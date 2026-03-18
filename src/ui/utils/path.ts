import os from "os";
import path from "path";

export function tildeifyPath(fullPath: string): string {
  const home = os.homedir();
  if (fullPath === home) return "~";
  if (fullPath.startsWith(home)) {
    return `~${path.sep}${path.relative(home, fullPath)}`;
  }
  return fullPath;
}

export function shortenPath(p: string, maxLen: number = 40): string {
  if (p.length <= maxLen) return p;
  const segments = p.split(path.sep).filter(Boolean);
  if (segments.length <= 2) return p;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const isTilde = p.startsWith("~");

  const start = isTilde ? "~" : `${path.sep}${first}`;
  const result = `${start}${path.sep}...${path.sep}${last}`;

  return result.length > maxLen ? last : result;
}
