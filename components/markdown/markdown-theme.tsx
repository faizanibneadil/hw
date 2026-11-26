import { markdownThemeCss } from "@/lib/markdown/theme-css";

/** Injects the code-highlighting theme CSS once for all rendered Markdown. */
export function MarkdownTheme() {
  return <style>{markdownThemeCss}</style>;
}
