export interface Key {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
  code?: string;
}

export const ESC = "\u001B";

// Parse the key itself
const KEY_INFO_MAP: Record<
  string,
  { name: string; shift?: boolean; ctrl?: boolean }
> = {
  "[200~": { name: "paste-start" },
  "[201~": { name: "paste-end" },
  "[[A": { name: "f1" },
  "[[B": { name: "f2" },
  "[[C": { name: "f3" },
  "[[D": { name: "f4" },
  "[[E": { name: "f5" },
  "[1~": { name: "home" },
  "[2~": { name: "insert" },
  "[3~": { name: "delete" },
  "[4~": { name: "end" },
  "[5~": { name: "pageup" },
  "[6~": { name: "pagedown" },
  "[7~": { name: "home" },
  "[8~": { name: "end" },
  "[11~": { name: "f1" },
  "[12~": { name: "f2" },
  "[13~": { name: "f3" },
  "[14~": { name: "f4" },
  "[15~": { name: "f5" },
  "[17~": { name: "f6" },
  "[18~": { name: "f7" },
  "[19~": { name: "f8" },
  "[20~": { name: "f9" },
  "[21~": { name: "f10" },
  "[23~": { name: "f11" },
  "[24~": { name: "f12" },
  "[A": { name: "up" },
  "[B": { name: "down" },
  "[C": { name: "right" },
  "[D": { name: "left" },
  "[E": { name: "clear" },
  "[F": { name: "end" },
  "[H": { name: "home" },
  "[P": { name: "f1" },
  "[Q": { name: "f2" },
  "[R": { name: "f3" },
  "[S": { name: "f4" },
  OA: { name: "up" },
  OB: { name: "down" },
  OC: { name: "right" },
  OD: { name: "left" },
  OE: { name: "clear" },
  OF: { name: "end" },
  OH: { name: "home" },
  OP: { name: "f1" },
  OQ: { name: "f2" },
  OR: { name: "f3" },
  OS: { name: "f4" },
  "[[5~": { name: "pageup" },
  "[[6~": { name: "pagedown" },
  "[9u": { name: "tab" },
  "[13u": { name: "return" },
  "[27u": { name: "escape" },
  "[32u": { name: "space" },
  "[127u": { name: "backspace" },
  "[57414u": { name: "return" }, // Numpad Enter
  "[a": { name: "up", shift: true },
  "[b": { name: "down", shift: true },
  "[c": { name: "right", shift: true },
  "[d": { name: "left", shift: true },
  "[e": { name: "clear", shift: true },
  "[2$": { name: "insert", shift: true },
  "[3$": { name: "delete", shift: true },
  "[5$": { name: "pageup", shift: true },
  "[6$": { name: "pagedown", shift: true },
  "[7$": { name: "home", shift: true },
  "[8$": { name: "end", shift: true },
  "[Z": { name: "tab", shift: true },
  Oa: { name: "up", ctrl: true },
  Ob: { name: "down", ctrl: true },
  Oc: { name: "right", ctrl: true },
  Od: { name: "left", ctrl: true },
  Oe: { name: "clear", ctrl: true },
  "[2^": { name: "insert", ctrl: true },
  "[3^": { name: "delete", ctrl: true },
  "[5^": { name: "pageup", ctrl: true },
  "[6^": { name: "pagedown", ctrl: true },
  "[7^": { name: "home", ctrl: true },
  "[8^": { name: "end", ctrl: true },
};

const MAC_ALT_KEY_CHARACTER_MAP: Record<string, string> = {
  "\u222B": "b", // "∫" back one word
  "\u0192": "f", // "ƒ" forward one word
  "\u00B5": "m", // "µ" toggle markup view
};

export type KeypressHandler = (key: Key) => void;

/**
 * Translates raw keypress characters into key events.
 * Buffers escape sequences until a full sequence is received or
 * until an empty string is sent to indicate a timeout.
 */
function* emitKeys(
  keypressHandler: KeypressHandler,
): Generator<void, void, string> {
  while (true) {
    let ch = yield;
    let sequence = ch;
    let escaped = false;

    let name: string | undefined = undefined;
    let ctrl = false;
    let meta = false;
    let shift = false;
    let code = undefined;

    if (ch === ESC) {
      escaped = true;
      ch = yield;
      sequence += ch;

      if (ch === ESC) {
        ch = yield;
        sequence += ch;
      }
    }

    // Handle timeout: if ESC was pressed with no following character, treat as standalone ESC key
    if (escaped && ch === "") {
      keypressHandler({
        name: "escape",
        ctrl: false,
        meta: false,
        shift: false,
        sequence: ESC,
        code: undefined,
      });
      return;
    }

    if (escaped && (ch === "O" || ch === "[" || ch === "]")) {
      // ANSI escape sequence
      code = ch;
      let modifier = 0;

      if (ch === "]") {
        // OSC sequence handling can be simplified or omitted for now if not needed
        // Using simplified logic from gemini-cli
        // Defaulting to break for now to avoid complexity unless specifically needed
        // But let's support basic buffer drain
      } else if (ch === "O") {
        // ESC O letter
        ch = yield;
        sequence += ch;

        if (ch >= "0" && ch <= "9") {
          modifier = parseInt(ch, 10) - 1;
          ch = yield;
          sequence += ch;
        }

        code += ch;
      } else if (ch === "[") {
        // ESC [ letter
        ch = yield;
        sequence += ch;

        if (ch === "[") {
          code += ch;
          ch = yield;
          sequence += ch;
        }

        const cmdStart = sequence.length - 1;

        // collect digits
        while (ch >= "0" && ch <= "9") {
          ch = yield;
          sequence += ch;
        }

        // skip modifier
        if (ch === ";") {
          while (ch === ";") {
            ch = yield;
            sequence += ch;
            while (ch >= "0" && ch <= "9") {
              ch = yield;
              sequence += ch;
            }
          }
        }

        const cmd = sequence.slice(cmdStart);
        let match;

        if ((match = /^(\d+)(?:;(\d+))?(?:;(\d+))?([~^$u])$/.exec(cmd))) {
          if (match[1] === "27" && match[3] && match[4] === "~") {
            code += match[3] + "u";
            modifier = parseInt(match[2] ?? "1", 10) - 1;
          } else {
            code += match[1] + match[4];
            modifier = parseInt(match[2] ?? "1", 10) - 1;
          }
        } else if ((match = /^(\d+)?(?:;(\d+))?([A-Za-z])$/.exec(cmd))) {
          code += match[3];
          modifier = parseInt(match[2] ?? match[1] ?? "1", 10) - 1;
        } else {
          code += cmd;
        }
      }

      // Parse modifier
      ctrl = !!(modifier & 4);
      meta = !!(modifier & 10);
      shift = !!(modifier & 1);

      const keyInfo = KEY_INFO_MAP[code];
      if (keyInfo) {
        name = keyInfo.name;
        if (keyInfo.shift) shift = true;
        if (keyInfo.ctrl) ctrl = true;
      } else {
        name = "undefined";
      }
    } else if (ch === "\r") {
      name = "return";
      meta = escaped;
    } else if (ch === "\n") {
      name = "enter";
      meta = escaped;
    } else if (ch === "\t") {
      name = "tab";
      meta = escaped;
    } else if (ch === "\b" || ch === "\x7f") {
      name = "backspace";
      meta = escaped;
    } else if (ch === ESC) {
      name = "escape";
      meta = escaped;
    } else if (ch === " ") {
      name = "space";
      meta = escaped;
    } else if (!escaped && ch <= "\x1a") {
      name = String.fromCharCode(ch.charCodeAt(0) + "a".charCodeAt(0) - 1);
      ctrl = true;
    } else if (/^[0-9A-Za-z]$/.exec(ch) !== null) {
      name = ch.toLowerCase();
      shift = /^[A-Z]$/.exec(ch) !== null;
      meta = escaped;
    } else if (MAC_ALT_KEY_CHARACTER_MAP[ch] && process.platform === "darwin") {
      name = MAC_ALT_KEY_CHARACTER_MAP[ch];
      meta = true;
    }

    if (sequence.length !== 0) {
      keypressHandler({
        name: name || sequence,
        ctrl,
        meta,
        shift,
        sequence,
        code,
      });
    }
  }
}

export function createDataListener(keypressHandler: KeypressHandler) {
  const parser = emitKeys(keypressHandler);
  parser.next(); // prime

  let timeoutId: NodeJS.Timeout;
  return (data: string) => {
    clearTimeout(timeoutId);
    for (const char of data) {
      parser.next(char);
    }
    // Timeout for escape sequences
    if (data.length !== 0) {
      timeoutId = setTimeout(() => parser.next(""), 50);
    }
  };
}
