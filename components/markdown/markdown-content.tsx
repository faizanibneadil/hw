"use client";

import { memo } from "react";
import { Markdown, type MarkdownComponents } from "@tanstack/markdown/react";
import { streamingMarkdownExtension } from "@tanstack/markdown/extensions/streaming";

import { cn } from "@/lib/utils";
import { highlightMarkdownCode } from "@/lib/markdown/highlighter";

const streamingExtensions = [streamingMarkdownExtension()];

const components = {
  // Wide result tables scroll horizontally instead of breaking the layout on phones.
  table(props) {
    return (
      <div className="table-wrap">
        <table {...props} />
      </div>
    );
  },
  a(props) {
    const href = props.href ?? "";
    const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(href);
    const allowed = !hasProtocol || /^(https?:|mailto:)/i.test(href);
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        {...props}
        href={allowed ? href : undefined}
        rel={external ? "nofollow noopener noreferrer" : props.rel}
        target={external ? "_blank" : props.target}
      />
    );
  },
} satisfies MarkdownComponents;

interface MarkdownContentProps {
  children: string;
  /** Use the streaming extension (hides empty trailing blocks, renders unclosed fences). */
  streaming?: boolean;
  className?: string;
}

/** Renders Markdown with TanStack Markdown (GFM tables, highlighted code, raw HTML disabled). */
export const MarkdownContent = memo(function MarkdownContent({ children, streaming, className }: MarkdownContentProps) {
  return (
    <div className={cn("markdown-renderer prose-hw text-sm", className)}>
      <Markdown
        components={components}
        highlighter={highlightMarkdownCode}
        extensions={streaming ? streamingExtensions : undefined}
        frontmatter={false}
        headingIds={false}
      >
        {children}
      </Markdown>
    </div>
  );
});
