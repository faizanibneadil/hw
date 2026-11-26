import type { ReactNode } from "react";

import { FileChip } from "@/components/prompt/file-chip";

interface UserMessageProps {
  fileNames?: string[];
  children: ReactNode;
}

export function UserMessage({ fileNames, children }: UserMessageProps) {
  return (
    <div className="flex flex-col items-end gap-1.5" data-role="user">
      {fileNames && fileNames.length > 0 && (
        <div className="flex max-w-full flex-wrap justify-end gap-1.5" aria-label="Attached files">
          {fileNames.map((name) => (
            <FileChip key={name} name={name} />
          ))}
        </div>
      )}
      <div className="max-w-[min(100%,42rem)] min-w-0 rounded-2xl bg-muted px-4 py-2.5">{children}</div>
    </div>
  );
}
