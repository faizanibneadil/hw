import { createHighlighter } from "@tanstack/highlight/core";
import { c } from "@tanstack/highlight/languages/c";
import { cpp } from "@tanstack/highlight/languages/cpp";
import { csharp } from "@tanstack/highlight/languages/csharp";
import { css } from "@tanstack/highlight/languages/css";
import { go } from "@tanstack/highlight/languages/go";
import { html } from "@tanstack/highlight/languages/html";
import { java } from "@tanstack/highlight/languages/java";
import { js } from "@tanstack/highlight/languages/js";
import { json } from "@tanstack/highlight/languages/json";
import { jsx } from "@tanstack/highlight/languages/jsx";
import { kotlin } from "@tanstack/highlight/languages/kotlin";
import { markdown } from "@tanstack/highlight/languages/markdown";
import { php } from "@tanstack/highlight/languages/php";
import { plaintext } from "@tanstack/highlight/languages/plaintext";
import { python } from "@tanstack/highlight/languages/python";
import { ruby } from "@tanstack/highlight/languages/ruby";
import { rust } from "@tanstack/highlight/languages/rust";
import { scss } from "@tanstack/highlight/languages/scss";
import { shell } from "@tanstack/highlight/languages/shell";
import { sql } from "@tanstack/highlight/languages/sql";
import { swift } from "@tanstack/highlight/languages/swift";
import { ts } from "@tanstack/highlight/languages/ts";
import { tsx } from "@tanstack/highlight/languages/tsx";
import { yaml } from "@tanstack/highlight/languages/yaml";
import { createTanStackMarkdownHighlighter } from "@tanstack/highlight/markdown";
import type { CodeHighlighter } from "@tanstack/markdown";

/**
 * Synchronous, escaping code highlighter for TanStack Markdown (TanStack Highlight adapter).
 * Unknown fence languages fall back to escaped plain text.
 */
export const highlightMarkdownCode: CodeHighlighter = createTanStackMarkdownHighlighter(
  createHighlighter({
    languages: [
      plaintext, html, css, scss, js, jsx, ts, tsx, json, markdown, python, java, c, cpp,
      csharp, php, go, ruby, rust, kotlin, swift, sql, shell, yaml,
    ],
  }),
);
