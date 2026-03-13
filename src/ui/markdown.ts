/**
 * Markdown renderer for terminal using marked-terminal
 * Converts Markdown to ANSI escape codes for terminal display
 */

import { marked } from "marked";
// @ts-ignore - marked-terminal types are incomplete
import { markedTerminal } from "marked-terminal";

// Configure marked with terminal renderer
// @ts-ignore - types are incomplete but runtime works
marked.use(markedTerminal());

/**
 * Render markdown string to ANSI formatted text
 * @param markdown - Markdown string to render
 * @returns ANSI formatted string for terminal display
 */
export function renderMarkdown(markdown: string): string {
  try {
    const html = marked.parse(markdown, { async: false }) as string;
    return html;
  } catch (error) {
    // If markdown parsing fails, return original text
    console.error("Markdown render error:", error);
    return markdown;
  }
}
