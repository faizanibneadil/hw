"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

import { CODE_BLOCK_LANGUAGES } from "@/lib/files/languages";

/** Code block with a small language selector; highlighting comes from CodeBlockLowlight decorations. */
export function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const language = (node.attrs.language as string | null) ?? "";

  return (
    <NodeViewWrapper className="code-block group/code relative my-2">
      <select
        contentEditable={false}
        aria-label="Code language"
        disabled={!editor.isEditable}
        value={language}
        onChange={(event) => updateAttributes({ language: event.target.value || null })}
        className="absolute top-1.5 right-1.5 z-10 h-6 rounded border border-border bg-background px-1 text-xs text-muted-foreground opacity-70 outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Auto</option>
        {CODE_BLOCK_LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>
      <pre spellCheck={false}>
        <NodeViewContent<"code"> as="code" className={language ? `language-${language}` : undefined} />
      </pre>
    </NodeViewWrapper>
  );
}
