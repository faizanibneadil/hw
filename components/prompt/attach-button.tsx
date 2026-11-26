"use client";

import { useRef } from "react";
import { PaperclipIcon } from "lucide-react";

import { ACCEPT_ATTRIBUTE } from "@/lib/files/languages";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AttachButtonProps {
  /** Reason the button is disabled; shown as a tooltip. */
  disabledReason?: string;
  onFiles: (files: File[]) => void;
}

export function AttachButton({ disabledReason, onFiles }: AttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const disabled = Boolean(disabledReason);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        data-testid="file-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span keeps the tooltip working while the button is disabled */}
          <span tabIndex={disabled ? 0 : -1} className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach code files"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <PaperclipIcon />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason ?? "Attach code files (up to 5, 50 KB each)"}</TooltipContent>
      </Tooltip>
    </>
  );
}
