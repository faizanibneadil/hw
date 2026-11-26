/** Code-file extensions accepted as attachments, mapped to a highlight/fence language id. */
export const EXTENSION_LANGUAGES: Record<string, string> = {
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "tsx",
  mts: "typescript",
  cts: "typescript",
  vue: "html",
  svelte: "html",
  json: "json",
  md: "markdown",
  py: "python",
  ipynb: "json",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  cs: "csharp",
  php: "php",
  go: "go",
  rb: "ruby",
  rs: "rust",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  bat: "dos",
  xml: "xml",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  txt: "plaintext",
  csv: "plaintext",
  dart: "dart",
  lua: "lua",
  pl: "perl",
  r: "r",
  scala: "scala",
  m: "objectivec",
  vb: "vbnet",
  asm: "x86asm",
  s: "x86asm",
  graphql: "graphql",
  gql: "graphql",
};

/** Extension-less files that are clearly source code. */
export const SPECIAL_FILE_NAMES: Record<string, string> = {
  makefile: "makefile",
  dockerfile: "dockerfile",
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Language id for a file name, or null when it is not an accepted code file. */
export function languageForFile(name: string): string | null {
  const special = SPECIAL_FILE_NAMES[name.toLowerCase()];
  if (special) return special;
  return EXTENSION_LANGUAGES[extensionOf(name)] ?? null;
}

/** Value for the file input's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = Object.keys(EXTENSION_LANGUAGES)
  .map((ext) => `.${ext}`)
  .join(",");

/** Languages offered in the code block language selector (lowlight ids). */
export const CODE_BLOCK_LANGUAGES: { value: string; label: string }[] = [
  { value: "plaintext", label: "Plain text" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "go", label: "Go" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "kotlin", label: "Kotlin" },
  { value: "swift", label: "Swift" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Shell" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
];
