// Shared by the Next.js app and the Worker: no browser-only dependencies, relative imports only.
import type { ModelMessage } from "ai";

import { extractCodeBlocks, replaceCodeBlocks } from "../editor/code-blocks";
import { MAX_OUTPUT_TOKENS } from "./models";
import { SYSTEM_PROMPT } from "./system-prompt";

export interface LockedFile {
  name: string;
  language: string;
  content: string;
}

export interface LockedCode {
  files: LockedFile[];
  /** Code blocks from the chat's first message. */
  blocks: { language: string; code: string }[];
}

/** Rough token estimate (≈3.5 characters per token for code and English). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function numbered(code: string): string {
  const lines = code.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width, " ")} | ${line}`).join("\n");
}

export function lockedCodeFromFirstMessage(files: LockedFile[], firstMessageMarkdown: string | undefined): LockedCode {
  return { files, blocks: firstMessageMarkdown ? extractCodeBlocks(firstMessageMarkdown) : [] };
}

/** The student's code as one system message: every file with its name and line numbers. */
export function formatLockedCode(code: LockedCode): string {
  const parts = [
    "STUDENT CODE (locked for this chat; line numbers are added for reference and are not part of the code):",
  ];
  for (const file of code.files) {
    parts.push(`\n### File: ${file.name}\n\`\`\`${file.language}\n${numbered(file.content)}\n\`\`\``);
  }
  code.blocks.forEach((block, index) => {
    const name = `snippet-${index + 1}`;
    parts.push(`\n### File: ${name} (code block from the teacher's first message)\n\`\`\`${block.language}\n${numbered(block.code)}\n\`\`\``);
  });
  if (!code.files.length && !code.blocks.length) parts.push("\n(No code was provided.)");
  return parts.join("\n");
}

function messageText(message: ModelMessage): string {
  if (typeof message.content === "string") return message.content;
  return message.content.map((part) => ("text" in part && typeof part.text === "string" ? part.text : "")).join("\n");
}

/**
 * Drops the oldest history so system prompt + student code + history fit the budget.
 * The system messages are not part of `messages`; they are always sent.
 * The latest user message is always kept, and history always starts with a user message.
 */
export function trimHistory(messages: ModelMessage[], budgetTokens: number): ModelMessage[] {
  const kept: ModelMessage[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = estimateTokens(messageText(messages[i])) + 8;
    if (kept.length > 0 && used + cost > budgetTokens) break;
    kept.unshift(messages[i]);
    used += cost;
  }
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return kept;
}

/**
 * The first user message's code blocks are already in the locked student code (as snippet-N),
 * so in the history they are replaced by a short reference instead of being sent twice.
 */
export function referenceFirstMessageCode(messages: ModelMessage[]): ModelMessage[] {
  const first = messages[0];
  if (!first || first.role !== "user") return messages;
  const toText = (text: string) =>
    replaceCodeBlocks(text, (i) => `[code block snippet-${i}: see the student code above]`);
  const content =
    typeof first.content === "string"
      ? toText(first.content)
      : first.content.map((part) => (part.type === "text" ? { ...part, text: toText(part.text) } : part));
  return [{ ...first, content } as ModelMessage, ...messages.slice(1)];
}

/**
 * The history sent to the model: first-message code blocks replaced by references, then trimmed so
 * system prompt + student code + history + answer fit the model's context window.
 */
export function prepareHistory(messages: ModelMessage[], codeMessage: string, contextTokens: number): ModelMessage[] {
  const budget = contextTokens - MAX_OUTPUT_TOKENS - estimateTokens(SYSTEM_PROMPT) - estimateTokens(codeMessage);
  return trimHistory(referenceFirstMessageCode(messages), Math.max(budget, 0));
}
