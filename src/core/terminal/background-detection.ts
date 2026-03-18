import * as fs from "node:fs";

export type TerminalBackground = "dark" | "light";

interface DetectedBackground {
  hex: string;
  type: TerminalBackground;
}

const OSC_11_QUERY = "\x1b]11;?\x1b\\";
const OSC_11_REGEX =
  /\x1b\]11;rgb:([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})\/([0-9a-fA-F]{1,4})(\x1b\\|\x07)/;
const DEVICE_ATTRIBUTES_QUERY = "\x1b[c";
const DEVICE_ATTRIBUTES_REGEX = /\x1b\[\?(\d+)(;\d+)*c/;
const HIDDEN_MODE = "\x1b[8m";
const CLEAR_LINE_AND_RETURN = "\x1b[2K\r";
const RESET_ATTRIBUTES = "\x1b[0m";

const LUMINANCE_THRESHOLD = 128;

function parseColorComponent(hex: string): number {
  const val = parseInt(hex, 16);
  if (hex.length === 1) return (val / 15) * 255;
  if (hex.length === 2) return val;
  if (hex.length === 3) return (val / 4095) * 255;
  if (hex.length === 4) return (val / 65535) * 255;
  return val;
}

function parseColor(rHex: string, gHex: string, bHex: string): string {
  const r = parseColorComponent(rHex);
  const g = parseColorComponent(gHex);
  const b = parseColorComponent(bHex);
  const toHex = (c: number) => Math.round(c).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

let detectedBackground: DetectedBackground | null = null;
let detectionComplete = false;

export async function detectTerminalBackground(): Promise<DetectedBackground | null> {
  if (detectionComplete) {
    return detectedBackground;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    detectionComplete = true;
    return null;
  }

  return new Promise((resolve) => {
    const originalRawMode = process.stdin.isRaw;
    if (!originalRawMode) {
      process.stdin.setRawMode(true);
    }

    let buffer = "";
    let bgReceived = false;
    let deviceAttributesReceived = false;
    const timeoutId: NodeJS.Timeout = setTimeout(cleanup, 500);

    function cleanup() {
      clearTimeout(timeoutId);
      process.stdin.removeListener("data", onData);
      if (!originalRawMode) {
        process.stdin.setRawMode(false);
      }
      detectionComplete = true;
      resolve(detectedBackground);
    }

    function onData(data: Buffer) {
      buffer += data.toString();

      if (!bgReceived) {
        const match = buffer.match(OSC_11_REGEX);
        if (match) {
          bgReceived = true;
          const hex = parseColor(match[1], match[2], match[3]);
          const luminance = getLuminance(hex);
          detectedBackground = {
            hex,
            type: luminance >= LUMINANCE_THRESHOLD ? "light" : "dark",
          };
        }
      }

      if (!deviceAttributesReceived) {
        const match = buffer.match(DEVICE_ATTRIBUTES_REGEX);
        if (match) {
          deviceAttributesReceived = true;
          cleanup();
        }
      }
    }

    process.stdin.on("data", onData);

    try {
      fs.writeSync(
        process.stdout.fd,
        HIDDEN_MODE +
          OSC_11_QUERY +
          DEVICE_ATTRIBUTES_QUERY +
          CLEAR_LINE_AND_RETURN +
          RESET_ATTRIBUTES,
      );
    } catch {
      cleanup();
    }
  });
}

export function getDetectedBackground(): DetectedBackground | null {
  return detectedBackground;
}

export function getTerminalBackground(): TerminalBackground {
  if (detectedBackground) {
    return detectedBackground.type;
  }
  return "dark";
}

export function getTerminalBackgroundHex(): string {
  if (detectedBackground) {
    return detectedBackground.hex;
  }
  return "#000000";
}