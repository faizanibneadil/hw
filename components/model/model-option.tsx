"use client";

import { CheckIcon, DownloadIcon, RotateCwIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { LocalModelConfig } from "@/lib/ai/models";
import { isSelectable, modelManager, type ModelStatus } from "@/lib/ai/model-manager";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ModelOptionProps {
  model: LocalModelConfig;
  status: ModelStatus | undefined;
  active: boolean;
  /** Selection is temporarily disabled (a response is generating). */
  locked: boolean;
  onSelected: () => void;
}

function statusText(status: ModelStatus | undefined, active: boolean): string {
  switch (status?.kind) {
    case "checking":
      return "Checking…";
    case "unsupported":
      return status.reason;
    case "not-downloaded":
      return "Not downloaded";
    case "downloading":
      return `Downloading… ${Math.round(status.progress * 100)}%`;
    case "loading":
      return `Loading… ${Math.round(status.progress * 100)}%`;
    case "downloaded":
      return active ? "Loading…" : "Downloaded";
    case "ready":
      return active ? "Ready" : "Downloaded";
    case "error":
      return `Failed: ${status.message}`;
    default:
      return "";
  }
}

/** One model row: select it when downloaded, otherwise show Download / progress / Retry. */
export function ModelOption({ model, status, active, locked, onSelected }: ModelOptionProps) {
  const selectable = isSelectable(status) && (!locked || active);
  const progress = status?.kind === "downloading" || status?.kind === "loading" ? status.progress : null;

  return (
    <li className="flex items-center gap-1 rounded-md">
      <button
        type="button"
        aria-pressed={active}
        disabled={!selectable}
        onClick={() => {
          modelManager.select(model.id);
          onSelected();
        }}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selectable ? "hover:bg-accent" : "cursor-not-allowed opacity-60",
        )}
      >
        <CheckIcon className={cn("mt-0.5 size-4 shrink-0", active ? "opacity-100" : "opacity-0")} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-medium">{model.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{model.sizeLabel}</span>
          </span>
          <span className={cn("block text-xs text-muted-foreground", status?.kind === "error" && "text-destructive-text")}>
            {statusText(status, active)}
          </span>
          {progress !== null && (
            <Progress value={progress * 100} className="mt-1" aria-label={`${model.name} progress`} />
          )}
        </span>
      </button>
      {status?.kind === "not-downloaded" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          aria-label={`Download ${model.name}`}
          onClick={() => void modelManager.download(model.id)}
        >
          <DownloadIcon /> Download
        </Button>
      )}
      {status?.kind === "error" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          aria-label={`Retry ${model.name}`}
          onClick={() => modelManager.retry(model.id)}
        >
          <RotateCwIcon /> Retry
        </Button>
      )}
    </li>
  );
}
