import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";

/** Code colours for rendered Markdown, switching with the `.dark` class (light/dark mode). */
export const markdownThemeCss = createThemeCss({
  light: githubLightTheme,
  dark: githubDarkTheme,
  lightSelector: ".markdown-renderer",
  darkSelector: ".dark .markdown-renderer",
  codeBlockSelector: ".markdown-renderer pre.tm-code",
  lineNumbersSelector: ".markdown-renderer .tm-code--line-numbers",
});
