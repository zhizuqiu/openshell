/**
 * File Operation Tools for LangChain Agent
 * Using tool() API from langchain 1.2.10
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

const DEFAULT_READ_LIMIT = 2000;

/**
 * Helper to create standard structured tool response
 */
function createResult(status: "success" | "error" | "canceled", output: string) {
  return JSON.stringify({ status, output });
}

/**
 * Check if a file is binary
 */
async function isBinaryFile(
  filepath: string,
  fileSize: number,
): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase();
  const binaryExtensions = [".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".jar", ".war", ".7z", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".bin", ".dat", ".obj", ".o", ".a", ".lib", ".wasm", ".pyc", ".pyo", ".pdf"];
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
      if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) nonPrintableCount++;
    }
    return nonPrintableCount / result.bytesRead > 0.3;
  } finally {
    await fh.close();
  }
}

/**
 * read_file - Read file or directory content
 */
export const createReadFileTool = () => {
  return tool(
    async (input: { filePath: string; offset?: number; limit?: number }) => {
      const { filePath, offset = 1, limit = DEFAULT_READ_LIMIT } = input;
      if (offset < 1) return createResult("error", "Error: offset must be >= 1");
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

      try {
        const stat = await fs.stat(resolvedPath);
        if (stat.isDirectory()) {
          const dirents = await fs.readdir(resolvedPath, { withFileTypes: true });
          const entries = await Promise.all(dirents.map(async (dirent) => {
            if (dirent.isDirectory()) return dirent.name + "/";
            if (dirent.isSymbolicLink()) {
              const target = await fs.stat(path.join(resolvedPath, dirent.name)).catch(() => undefined);
              if (target?.isDirectory()) return dirent.name + "/";
            }
            return dirent.name;
          }));
          entries.sort((a, b) => a.localeCompare(b));
          const sliced = entries.slice(offset - 1, offset - 1 + limit);
          return createResult("success", `Directory: ${resolvedPath}\nEntries: ${sliced.join("\n")}`);
        }

        if (stat.isFile()) {
          const isBinary = await isBinaryFile(resolvedPath, Number(stat.size));
          if (isBinary) return createResult("error", `Cannot read binary file: ${resolvedPath}`);
          const contentRaw = await fs.readFile(resolvedPath, "utf-8");
          const lines = contentRaw.split("\n");
          const sliced = lines.slice(offset - 1, offset - 1 + limit);
          return createResult("success", `File: ${resolvedPath}\n\n${sliced.map((l, i) => `${i + offset}: ${l}`).join("\n")}`);
        }
        return createResult("error", "Error: Path is not a file or directory");
      } catch (error) {
        return createResult("error", `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
    {
      name: "read_file",
      description: "Read file or directory content.",
      schema: z.object({ filePath: z.string(), offset: z.number().optional(), limit: z.number().optional() }),
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
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      try {
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, content, "utf-8");
        return createResult("success", `Wrote file: ${resolvedPath}`);
      } catch (error) {
        return createResult("error", `Error writing file: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
    {
      name: "write_file",
      description: "Create or overwrite a file.",
      schema: z.object({ filePath: z.string(), content: z.string() }),
    },
  );
};

// ... (replacer methods kept same, but wrap edit_file return)

/**
 * edit_file - Edit file content
 */
export const createEditFileTool = () => {
  return tool(
    async (input: { filePath: string; oldString: string; newString: string; replaceAll?: boolean }) => {
      const { filePath, oldString, newString } = input;
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      try {
        const content = await fs.readFile(resolvedPath, "utf-8");
        const updated = content.replace(oldString, newString);
        await fs.writeFile(resolvedPath, updated, "utf-8");
        return createResult("success", `Edited file: ${resolvedPath}`);
      } catch (error) {
        return createResult("error", `Error editing file: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    },
    {
      name: "edit_file",
      description: "Edit file content.",
      schema: z.object({ filePath: z.string(), oldString: z.string(), newString: z.string(), replaceAll: z.boolean().optional() }),
    },
  );
};

export function createFileTools() {
  return [createReadFileTool(), createWriteFileTool(), createEditFileTool()];
}
