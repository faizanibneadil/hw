"use client";

import { useState } from "react";
import { ChevronDownIcon, CpuIcon, LoaderCircleIcon } from "lucide-react";

import { MODELS, getModelConfig } from "@/lib/ai/models";
import { useModelManager } from "@/hooks/use-model-manager";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ModelOption } from "@/components/model/model-option";

/** Model dropdown inside the prompt input. Models must be downloaded before they can be selected. */
export function ModelSelector({ locked = false }: { /** A response is generating: switching is disabled. */ locked?: boolean }) {
  const { activeId, models } = useModelManager();
  const [open, setOpen] = useState(false);
  const active = getModelConfig(activeId);
  const status = models[activeId];
  const busy = status?.kind === "downloading" || status?.kind === "loading" || status?.kind === "checking";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Model: ${active?.name ?? "none"}. Change model`}
          className="h-8 max-w-48 gap-1 px-2 text-xs text-muted-foreground"
        >
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <CpuIcon />}
          <span className="truncate">{active?.name}</span>
          {status && (status.kind === "downloading" || status.kind === "loading") && (
            <span className="tabular-nums">{Math.round(status.progress * 100)}%</span>
          )}
          <ChevronDownIcon className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-1.5">
        <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
          {locked ? "Stop the current answer to switch models" : "Models run in your browser"}
        </p>
        <ul aria-label="Models" className="space-y-0.5">
          {MODELS.map((model) => (
            <ModelOption
              key={model.id}
              model={model}
              status={models[model.id]}
              active={model.id === activeId}
              locked={locked}
              onSelected={() => setOpen(false)}
            />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
