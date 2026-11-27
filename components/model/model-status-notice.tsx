"use client";

import { CircleAlertIcon, InfoIcon, RotateCwIcon } from "lucide-react";

import { getLocalModel } from "@/lib/ai/models";
import { modelManager } from "@/lib/ai/model-manager";
import { useModelManager } from "@/hooks/use-model-manager";
import { useInferenceSettings } from "@/hooks/use-inference-settings";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/** Offline mode status line above the prompt: download/load progress, errors with retry, WebGPU notice. */
export function ModelStatusNotice() {
  const { mode } = useInferenceSettings();
  const { webgpu, activeId, models } = useModelManager();
  const model = getLocalModel(activeId);
  const status = models[activeId];
  if (mode !== "local" || !model || !status) return null;

  let line: React.ReactNode = null;
  if (status.kind === "downloading" || status.kind === "loading") {
    const percent = Math.round(status.progress * 100);
    line = (
      <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
        <span>
          {status.kind === "downloading" ? `Downloading ${model.name} (${model.sizeLabel})` : `Loading ${model.name}`}…{" "}
          <span className="tabular-nums">{percent}%</span>
        </span>
        <Progress value={percent} aria-label="Model progress" />
      </div>
    );
  } else if (status.kind === "error") {
    line = (
      <div role="alert" className="flex items-center gap-2 text-destructive-text">
        <CircleAlertIcon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          Could not load {model.name}: {status.message}
        </span>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => modelManager.retry(activeId)}>
          <RotateCwIcon /> Retry
        </Button>
      </div>
    );
  } else if (status.kind === "checking" || status.kind === "downloaded") {
    line = <span role="status">Preparing {model.name}…</span>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-1.5 px-3 text-xs text-muted-foreground sm:px-4">
      {webgpu === false && (
        <p className="flex items-start gap-1.5">
          <InfoIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          WebGPU is not available in this browser, so the small model runs on the CPU (slower). Larger models are disabled.
        </p>
      )}
      {line && <div className="pb-1">{line}</div>}
    </div>
  );
}
