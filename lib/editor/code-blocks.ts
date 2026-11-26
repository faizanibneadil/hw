export interface CodeBlock {
  language: string;
  code: string;
}

type Segment = { kind: "text"; lines: string[] } | { kind: "code"; language: string; lines: string[] };

/** Splits Markdown into text and fenced code (``` or ~~~) segments. An unclosed fence runs to the end. */
function segments(markdown: string): Segment[] {
  const out: Segment[] = [];
  let text: string[] = [];
  let open: { fence: string; language: string; body: string[] } | null = null;

  for (const line of markdown.split("\n")) {
    if (!open) {
      const match = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/.exec(line);
      if (match) {
        if (text.length) out.push({ kind: "text", lines: text });
        text = [];
        open = { fence: match[1], language: match[2] ?? "", body: [] };
      } else {
        text.push(line);
      }
      continue;
    }
    const close = new RegExp(`^ {0,3}${open.fence[0]}{${open.fence.length},}\\s*$`);
    if (close.test(line)) {
      out.push({ kind: "code", language: open.language, lines: open.body });
      open = null;
    } else {
      open.body.push(line);
    }
  }
  if (open) out.push({ kind: "code", language: open.language, lines: open.body });
  if (text.length) out.push({ kind: "text", lines: text });
  return out;
}

function isCode(segment: Segment): segment is Extract<Segment, { kind: "code" }> {
  return segment.kind === "code" && segment.lines.join("\n").trim().length > 0;
}

/** Extracts the non-empty fenced code blocks from Markdown. */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  return segments(markdown)
    .filter(isCode)
    .map((s) => ({ language: s.language, code: s.lines.join("\n") }));
}

/**
 * Replaces each non-empty fenced code block with `reference(index)` (1-based, same order as
 * `extractCodeBlocks`); empty blocks are dropped.
 */
export function replaceCodeBlocks(markdown: string, reference: (index: number) => string): string {
  let index = 0;
  return segments(markdown)
    .map((s) => (s.kind === "text" ? s.lines.join("\n") : isCode(s) ? reference(++index) : ""))
    .join("\n");
}
