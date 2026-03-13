/**
 * File Operation Tools for LangChain Agent
 * Using tool() API from langchain 1.2.10
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { createTwoFilesPatch, diffLines } from "diff";

const DEFAULT_READ_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;
const MAX_BYTES = 50 * 1024;

/**
 * Check if a file is binary
 */
async function isBinaryFile(
  filepath: string,
  fileSize: number,
): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase();
  const binaryExtensions = [
    ".zip",
    ".tar",
    ".gz",
    ".exe",
    ".dll",
    ".so",
    ".jar",
    ".war",
    ".7z",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".odt",
    ".ods",
    ".odp",
    ".bin",
    ".dat",
    ".obj",
    ".o",
    ".a",
    ".lib",
    ".wasm",
    ".pyc",
    ".pyo",
    ".pdf",
  ];

  if (binaryExtensions.includes(ext)) return true;
  if (fileSize === 0) return false;

  const fh = await fs.open(filepath, "r");
  try {
    const sampleSize = Math.min(4096, fileSize);
    const bytes = Buffer.alloc(sampleSize);
    const result = await fh.read(bytes, 0, sampleSize, 0);
    if (result.bytesRead === 0) return false;

    let nonPrintableCount = 0;
    for (let i = 0; i < result.bytesRead; i++) {
      if (bytes[i] === 0) return true;
      if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
        nonPrintableCount++;
      }
    }
    return nonPrintableCount / result.bytesRead > 0.3;
  } finally {
    await fh.close();
  }
}

/**
 * Generate diff between old and new content
 */
function generateDiff(
  filePath: string,
  oldContent: string,
  newContent: string,
): string {
  const diff = createTwoFilesPatch(filePath, filePath, oldContent, newContent);
  return diff
    .split("\n")
    .filter(
      (line) =>
        line.startsWith("+") || line.startsWith("-") || line.startsWith(" "),
    )
    .join("\n");
}

/**
 * read_file - Read file or directory content
 */
export const createReadFileTool = () => {
  return tool(
    async (input: { filePath: string; offset?: number; limit?: number }) => {
      const { filePath, offset = 1, limit = DEFAULT_READ_LIMIT } = input;

      if (offset < 1) {
        return "Error: offset must be greater than or equal to 1";
      }

      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      try {
        const stat = await fs.stat(resolvedPath);

        if (stat.isDirectory()) {
          const dirents = await fs.readdir(resolvedPath, {
            withFileTypes: true,
          });
          const entries = await Promise.all(
            dirents.map(async (dirent) => {
              if (dirent.isDirectory()) return dirent.name + "/";
              if (dirent.isSymbolicLink()) {
                const target = await fs
                  .stat(path.join(resolvedPath, dirent.name))
                  .catch(() => undefined);
                if (target?.isDirectory()) return dirent.name + "/";
              }
              return dirent.name;
            }),
          );
          entries.sort((a, b) => a.localeCompare(b));

          const start = offset - 1;
          const sliced = entries.slice(start, start + limit);
          const truncated = start + sliced.length < entries.length;

          return `Directory: ${resolvedPath}
Entries (${entries.length} total${truncated ? `, showing ${sliced.length}` : ""}):
${sliced.join("\n")}${truncated ? `\n\n(Use offset=${offset + sliced.length} to view more)` : ""}`;
        }

        if (stat.isFile()) {
          const isBinary = await isBinaryFile(resolvedPath, Number(stat.size));
          if (isBinary) {
            return `Cannot read binary file: ${resolvedPath}
Size: ${stat.size} bytes
Hint: Use run_command with 'cat' or 'hexdump' to view binary files`;
          }

          const stream = await fs.open(resolvedPath, "r");
          const readline = await import("readline");
          const rl = readline.createInterface({
            input: stream.createReadStream(),
            crlfDelay: Infinity,
          });

          const raw: string[] = [];
          let bytes = 0;
          let lines = 0;
          let truncatedByBytes = false;
          let hasMoreLines = false;

          try {
            for await (const text of rl) {
              lines += 1;
              if (lines <= offset - 1) continue;

              if (raw.length >= limit) {
                hasMoreLines = true;
                continue;
              }

              const line =
                text.length > MAX_LINE_LENGTH
                  ? text.substring(0, MAX_LINE_LENGTH) + "... (line truncated)"
                  : text;
              const size =
                Buffer.byteLength(line, "utf-8") + (raw.length > 0 ? 1 : 0);
              if (bytes + size > MAX_BYTES) {
                truncatedByBytes = true;
                hasMoreLines = true;
                break;
              }

              raw.push(line);
              bytes += size;
            }
          } finally {
            rl.close();
            stream.close();
          }

          if (lines === 0 && offset === 1) {
            return `File: ${resolvedPath}
(Empty file)`;
          }

          if (lines < offset) {
            return `Error: Offset ${offset} is out of range for this file (${lines} lines)`;
          }

          const content = raw
            .map((line, index) => `${index + offset}: ${line}`)
            .join("\n");
          const totalLines = lines;
          const lastReadLine = offset + raw.length - 1;
          const nextOffset = lastReadLine + 1;

          let output = `File: ${resolvedPath}

${content}
`;

          if (truncatedByBytes) {
            output += `\n(Output capped at ${MAX_BYTES / 1024} KB. Showing lines ${offset}-${lastReadLine}. Use offset=${nextOffset} to continue.)`;
          } else if (hasMoreLines) {
            output += `\n(Showing lines ${offset}-${lastReadLine} of ${totalLines}. Use offset=${nextOffset} to continue.)`;
          } else {
            output += `\n(End of file - total ${totalLines} lines)`;
          }

          return output;
        }

        return `Error: Path is not a file or directory: ${resolvedPath}`;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          const dir = path.dirname(resolvedPath);
          const base = path.basename(resolvedPath);
          try {
            const entries = await fs.readdir(dir);
            const suggestions = entries
              .filter((entry) =>
                entry.toLowerCase().includes(base.toLowerCase()),
              )
              .slice(0, 3)
              .map((entry) => path.join(dir, entry));
            if (suggestions.length > 0) {
              return `File not found: ${resolvedPath}\n\nDid you mean:\n${suggestions.join("\n")}`;
            }
          } catch {
            // Ignore suggestion errors
          }
        }
        return `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
    {
      name: "read_file",
      description:
        "Read file or directory content. Use offset/limit for large files.",
      schema: z.object({
        filePath: z
          .string()
          .describe("The absolute path to the file or directory to read"),
        offset: z
          .number()
          .optional()
          .describe(
            "The line number to start reading from (1-indexed, default: 1)",
          ),
        limit: z
          .number()
          .optional()
          .describe("The maximum number of lines to read (default: 2000)"),
      }),
    },
  );
};

/**
 * write_file - Create or overwrite a file
 */
export const createWriteFileTool = () => {
  return tool(
    async (input: { filePath: string; content: string }) => {
      const { filePath, content } = input;
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      try {
        const exists = await fs
          .access(resolvedPath)
          .then(() => true)
          .catch(() => false);
        const oldContent = exists
          ? await fs.readFile(resolvedPath, "utf-8")
          : "";

        if (exists && oldContent === content) {
          return "No changes: File content is identical to existing content";
        }

        // Create parent directories if needed
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

        // Write the file
        await fs.writeFile(resolvedPath, content, "utf-8");

        const diff = generateDiff(resolvedPath, oldContent, content);

        const output = `Wrote file: ${resolvedPath}
${exists ? "Updated existing file" : "Created new file"}

Changes:
${diff || "(No diff - new file or empty change)"}`;

        return output;
      } catch (error) {
        return `Error writing file: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
    {
      name: "write_file",
      description:
        "Create or overwrite a file. Requires approval before execution.",
      schema: z.object({
        filePath: z.string().describe("The absolute path to the file to write"),
        content: z.string().describe("The content to write to the file"),
      }),
    },
  );
};

/**
 * Replacement strategies for edit_file tool
 */
type Replacer = (
  content: string,
  find: string,
) => Generator<string, void, unknown>;

const levenshtein = (a: string, b: string): number => {
  if (a === "" || b === "") return Math.max(a.length, b.length);
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
};

const SimpleReplacer: Replacer = function* (_content, find) {
  yield find;
};

const LineTrimmedReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");
  if (searchLines[searchLines.length - 1] === "") searchLines.pop();

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      let matchStartIndex = 0;
      for (let k = 0; k < i; k++)
        matchStartIndex += originalLines[k].length + 1;
      let matchEndIndex = matchStartIndex;
      for (let k = 0; k < searchLines.length; k++) {
        matchEndIndex += originalLines[i + k].length;
        if (k < searchLines.length - 1) matchEndIndex += 1;
      }
      yield content.substring(matchStartIndex, matchEndIndex);
    }
  }
};

const BlockAnchorReplacer: Replacer = function* (content, find) {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");
  if (searchLines.length < 3) return;
  if (searchLines[searchLines.length - 1] === "") searchLines.pop();

  const firstLineSearch = searchLines[0].trim();
  const lastLineSearch = searchLines[searchLines.length - 1].trim();
  const searchBlockSize = searchLines.length;

  const candidates: Array<{ startLine: number; endLine: number }> = [];
  for (let i = 0; i < originalLines.length; i++) {
    if (originalLines[i].trim() !== firstLineSearch) continue;
    for (let j = i + 2; j < originalLines.length; j++) {
      if (originalLines[j].trim() === lastLineSearch) {
        candidates.push({ startLine: i, endLine: j });
        break;
      }
    }
  }

  if (candidates.length === 0) return;

  if (candidates.length === 1) {
    const { startLine, endLine } = candidates[0];
    const actualBlockSize = endLine - startLine + 1;
    let similarity = 0;
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2);

    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim();
        const searchLine = searchLines[j].trim();
        const maxLen = Math.max(originalLine.length, searchLine.length);
        if (maxLen === 0) continue;
        const distance = levenshtein(originalLine, searchLine);
        similarity += (1 - distance / maxLen) / linesToCheck;
        if (similarity >= 0.0) break;
      }
    } else {
      similarity = 1.0;
    }

    if (similarity >= 0.0) {
      let matchStartIndex = 0;
      for (let k = 0; k < startLine; k++)
        matchStartIndex += originalLines[k].length + 1;
      let matchEndIndex = matchStartIndex;
      for (let k = startLine; k <= endLine; k++) {
        matchEndIndex += originalLines[k].length;
        if (k < endLine) matchEndIndex += 1;
      }
      yield content.substring(matchStartIndex, matchEndIndex);
    }
    return;
  }

  let bestMatch: { startLine: number; endLine: number } | null = null;
  let maxSimilarity = -1;

  for (const candidate of candidates) {
    const { startLine, endLine } = candidate;
    const actualBlockSize = endLine - startLine + 1;
    let similarity = 0;
    const linesToCheck = Math.min(searchBlockSize - 2, actualBlockSize - 2);

    if (linesToCheck > 0) {
      for (let j = 1; j < searchBlockSize - 1 && j < actualBlockSize - 1; j++) {
        const originalLine = originalLines[startLine + j].trim();
        const searchLine = searchLines[j].trim();
        const maxLen = Math.max(originalLine.length, searchLine.length);
        if (maxLen === 0) continue;
        const distance = levenshtein(originalLine, searchLine);
        similarity += 1 - distance / maxLen;
      }
      similarity /= linesToCheck;
    } else {
      similarity = 1.0;
    }

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  if (maxSimilarity >= 0.3 && bestMatch) {
    const { startLine, endLine } = bestMatch;
    let matchStartIndex = 0;
    for (let k = 0; k < startLine; k++)
      matchStartIndex += originalLines[k].length + 1;
    let matchEndIndex = matchStartIndex;
    for (let k = startLine; k <= endLine; k++) {
      matchEndIndex += originalLines[k].length;
      if (k < endLine) matchEndIndex += 1;
    }
    yield content.substring(matchStartIndex, matchEndIndex);
  }
};

const WhitespaceNormalizedReplacer: Replacer = function* (content, find) {
  const normalizeWhitespace = (text: string) =>
    text.replace(/\s+/g, " ").trim();
  const normalizedFind = normalizeWhitespace(find);

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (normalizeWhitespace(line) === normalizedFind) {
      yield line;
    } else {
      const normalizedLine = normalizeWhitespace(line);
      if (normalizedLine.includes(normalizedFind)) {
        const words = find.trim().split(/\s+/);
        if (words.length > 0) {
          const pattern = words
            .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("\\s+");
          try {
            const regex = new RegExp(pattern);
            const match = line.match(regex);
            if (match) yield match[0];
          } catch {
            // Invalid regex, skip
          }
        }
      }
    }
  }

  const findLines = find.split("\n");
  if (findLines.length > 1) {
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length);
      if (normalizeWhitespace(block.join("\n")) === normalizedFind) {
        yield block.join("\n");
      }
    }
  }
};

const IndentationFlexibleReplacer: Replacer = function* (content, find) {
  const removeIndentation = (text: string) => {
    const lines = text.split("\n");
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    if (nonEmptyLines.length === 0) return text;

    const minIndent = Math.min(
      ...nonEmptyLines.map((line) => {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
      }),
    );

    return lines
      .map((line) => (line.trim().length === 0 ? line : line.slice(minIndent)))
      .join("\n");
  };

  const normalizedFind = removeIndentation(find);
  const contentLines = content.split("\n");
  const findLines = find.split("\n");

  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const block = contentLines.slice(i, i + findLines.length).join("\n");
    if (removeIndentation(block) === normalizedFind) {
      yield block;
    }
  }
};

const EscapeNormalizedReplacer: Replacer = function* (content, find) {
  const unescapeString = (str: string): string => {
    return str.replace(/\\(n|t|r|'|"|`|\\|\n|\$)/g, (match, capturedChar) => {
      switch (capturedChar) {
        case "n":
          return "\n";
        case "t":
          return "\t";
        case "r":
          return "\r";
        case "'":
          return "'";
        case '"':
          return '"';
        case "`":
          return "`";
        case "\\":
          return "\\";
        case "\n":
          return "\n";
        case "$":
          return "$";
        default:
          return match;
      }
    });
  };

  const unescapedFind = unescapeString(find);

  if (content.includes(unescapedFind)) {
    yield unescapedFind;
  }

  const lines = content.split("\n");
  const findLines = unescapedFind.split("\n");

  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join("\n");
    const unescapedBlock = unescapeString(block);
    if (unescapedBlock === unescapedFind) {
      yield block;
    }
  }
};

const TrimmedBoundaryReplacer: Replacer = function* (content, find) {
  const trimmedFind = find.trim();
  if (trimmedFind === find) return;

  if (content.includes(trimmedFind)) {
    yield trimmedFind;
  }

  const lines = content.split("\n");
  const findLines = find.split("\n");

  for (let i = 0; i <= lines.length - findLines.length; i++) {
    const block = lines.slice(i, i + findLines.length).join("\n");
    if (block.trim() === trimmedFind) {
      yield block;
    }
  }
};

const ContextAwareReplacer: Replacer = function* (content, find) {
  const findLines = find.split("\n");
  if (findLines.length < 3) return;
  if (findLines[findLines.length - 1] === "") findLines.pop();

  const contentLines = content.split("\n");
  const firstLine = findLines[0].trim();
  const lastLine = findLines[findLines.length - 1].trim();

  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].trim() !== firstLine) continue;

    for (let j = i + 2; j < contentLines.length; j++) {
      if (contentLines[j].trim() === lastLine) {
        const blockLines = contentLines.slice(i, j + 1);
        const block = blockLines.join("\n");

        if (blockLines.length === findLines.length) {
          let matchingLines = 0;
          let totalNonEmptyLines = 0;

          for (let k = 1; k < blockLines.length - 1; k++) {
            const blockLine = blockLines[k].trim();
            const findLine = findLines[k].trim();
            if (blockLine.length > 0 || findLine.length > 0) {
              totalNonEmptyLines++;
              if (blockLine === findLine) matchingLines++;
            }
          }

          if (
            totalNonEmptyLines === 0 ||
            matchingLines / totalNonEmptyLines >= 0.5
          ) {
            yield block;
            break;
          }
        }
        break;
      }
    }
  }
};

const MultiOccurrenceReplacer: Replacer = function* (content, find) {
  let startIndex = 0;
  while (true) {
    const index = content.indexOf(find, startIndex);
    if (index === -1) break;
    yield find;
    startIndex = index + find.length;
  }
};

function replace(
  content: string,
  oldString: string,
  newString: string,
  replaceAll = false,
): { success: boolean; result?: string; error?: string } {
  if (oldString === newString) {
    return {
      success: false,
      error: "No changes to apply: oldString and newString are identical.",
    };
  }

  const replacers: Replacer[] = [
    SimpleReplacer,
    LineTrimmedReplacer,
    BlockAnchorReplacer,
    WhitespaceNormalizedReplacer,
    IndentationFlexibleReplacer,
    EscapeNormalizedReplacer,
    TrimmedBoundaryReplacer,
    ContextAwareReplacer,
    MultiOccurrenceReplacer,
  ];

  let notFound = true;
  let foundMultiple = false;

  for (const replacer of replacers) {
    for (const search of replacer(content, oldString)) {
      const index = content.indexOf(search);
      if (index === -1) continue;
      notFound = false;

      if (replaceAll) {
        return { success: true, result: content.replaceAll(search, newString) };
      }

      const lastIndex = content.lastIndexOf(search);
      if (index !== lastIndex) {
        foundMultiple = true;
        continue;
      }

      return {
        success: true,
        result:
          content.substring(0, index) +
          newString +
          content.substring(index + search.length),
      };
    }
  }

  if (notFound) {
    return {
      success: false,
      error:
        "Could not find oldString in the file. It must match exactly, including whitespace and line endings.",
    };
  }

  if (foundMultiple) {
    return {
      success: false,
      error:
        "Found multiple matches for oldString. Provide more surrounding context or use replaceAll: true.",
    };
  }

  return {
    success: false,
    error: "Could not find a unique match for oldString.",
  };
}

/**
 * edit_file - Edit file content with intelligent string replacement
 */
export const createEditFileTool = () => {
  return tool(
    async (input: {
      filePath: string;
      oldString: string;
      newString: string;
      replaceAll?: boolean;
    }) => {
      const { filePath, oldString, newString, replaceAll = false } = input;
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(process.cwd(), filePath);

      try {
        const exists = await fs
          .access(resolvedPath)
          .then(() => true)
          .catch(() => false);
        if (!exists) {
          return `Error: File not found: ${resolvedPath}`;
        }

        const stat = await fs.stat(resolvedPath);
        if (!stat.isFile()) {
          return `Error: Path is not a file: ${resolvedPath}`;
        }

        const oldContent = await fs.readFile(resolvedPath, "utf-8");
        const replaceResult = replace(
          oldContent,
          oldString,
          newString,
          replaceAll,
        );

        if (!replaceResult.success) {
          return `Error: ${replaceResult.error}`;
        }

        const contentNew = replaceResult.result!;
        await fs.writeFile(resolvedPath, contentNew, "utf-8");

        const diff = generateDiff(resolvedPath, oldContent, contentNew);

        let additions = 0;
        let deletions = 0;
        for (const change of diffLines(oldContent, contentNew)) {
          if (change.added) additions += change.count || 0;
          if (change.removed) deletions += change.count || 0;
        }

        return `Edited file: ${resolvedPath}

Changes (+${additions}/-${deletions}):
${diff || "(No visible diff)"}`;
      } catch (error) {
        return `Error editing file: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    },
    {
      name: "edit_file",
      description:
        "Edit file content by replacing oldString with newString. Requires approval.",
      schema: z.object({
        filePath: z.string().describe("The absolute path to the file to edit"),
        oldString: z
          .string()
          .describe(
            "The text to replace (must match exactly, including whitespace)",
          ),
        newString: z.string().describe("The text to replace it with"),
        replaceAll: z
          .boolean()
          .optional()
          .describe("Replace all occurrences (default: false)"),
      }),
    },
  );
};

/**
 * Create all file operation tools
 */
export function createFileTools() {
  return [createReadFileTool(), createWriteFileTool(), createEditFileTool()];
}
