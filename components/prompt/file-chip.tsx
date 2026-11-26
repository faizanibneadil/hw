import { FileCodeIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface FileChipProps {
  name: string;
  size?: number;
  onRemove?: () => void;
  className?: string;
}

/** Small chip showing an attached file name, optionally removable. */
export function FileChip({ name, size, onRemove, className }: FileChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border bg-muted/60 py-1 pr-1 pl-2 text-xs",
        !onRemove && "pr-2",
        className,
      )}
    >
      <FileCodeIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate font-medium">{name}</span>
      {size !== undefined && <span className="shrink-0 text-muted-foreground">{Math.max(1, Math.round(size / 1024))} KB</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}
