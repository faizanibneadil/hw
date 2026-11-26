export interface CodeBlock {
  language: string;
  code: string;
}

/** Extracts fenced code blocks (``` or ~~~) from Markdown. */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = markdown.split("\n");
  let open: { fence: string; language: string; body: string[] } | null = null;

  for (const line of lines) {
    if (!open) {
      const match = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/.exec(line);
      if (match) open = { fence: match[1], language: match[2] ?? "", body: [] };
      continue;
    }
    const close = new RegExp(`^ {0,3}${open.fence[0]}{${open.fence.length},}\\s*$`);
    if (close.test(line)) {
      blocks.push({ language: open.language, code: open.body.join("\n") });
      open = null;
    } else {
      open.body.push(line);
    }
  }
  if (open && open.body.length) blocks.push({ language: open.language, code: open.body.join("\n") });
  return blocks.filter((b) => b.code.trim().length > 0);
}
