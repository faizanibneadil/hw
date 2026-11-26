import { languageForFile } from "@/lib/files/languages";

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 50 * 1024;

export interface AttachedFile {
  name: string;
  language: string;
  content: string;
  size: number;
}

export interface FileCandidate {
  name: string;
  size: number;
  text: () => Promise<string>;
}

function formatKb(bytes: number) {
  return `${Math.ceil(bytes / 1024)} KB`;
}

/**
 * Validates newly picked files against the ones already attached.
 * Every rejected file produces one human-readable error; nothing fails silently.
 */
export async function validateFiles(
  picked: FileCandidate[],
  existing: AttachedFile[],
): Promise<{ accepted: AttachedFile[]; errors: string[] }> {
  const accepted: AttachedFile[] = [];
  const errors: string[] = [];
  const names = new Set(existing.map((f) => f.name.toLowerCase()));

  for (const file of picked) {
    const language = languageForFile(file.name);
    if (!language) {
      errors.push(`"${file.name}" is not a code file. Attach source files such as .py, .js, .html or .java.`);
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`"${file.name}" is ${formatKb(file.size)}. Each file must be 50 KB or smaller.`);
      continue;
    }
    if (names.has(file.name.toLowerCase())) {
      errors.push(`A file named "${file.name}" is already attached.`);
      continue;
    }
    if (existing.length + accepted.length >= MAX_FILES) {
      errors.push(`You can attach at most ${MAX_FILES} files per chat. "${file.name}" was not added.`);
      continue;
    }
    let content: string;
    try {
      content = await file.text();
    } catch {
      errors.push(`"${file.name}" could not be read.`);
      continue;
    }
    if (content.includes("\u0000")) {
      errors.push(`"${file.name}" does not look like a text file.`);
      continue;
    }
    if (!content.trim()) {
      errors.push(`"${file.name}" is empty.`);
      continue;
    }
    names.add(file.name.toLowerCase());
    accepted.push({ name: file.name, language, content, size: file.size });
  }

  return { accepted, errors };
}
