"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, CloudIcon, CpuIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { CLOUD_MODELS, LOCAL_MODELS, getCloudModel, getLocalModel } from "@/lib/ai/models";
import { inferenceSettings } from "@/lib/ai/inference-settings";
import { enableCloudMode, enableOfflineMode } from "@/lib/ai/offline-mode";
import { useInferenceSettings } from "@/hooks/use-inference-settings";
import { useModelManager } from "@/hooks/use-model-manager";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ModelOption } from "@/components/model/model-option";
import { OfflineModeDialog } from "@/components/model/offline-mode-dialog";

/**
 * Model dropdown inside the prompt input: Workers AI models (default), plus the opt-in
 * Offline / Private mode with in-browser models that must be downloaded before use.
 */
export function ModelSelector({ locked = false }: { /** A response is generating: switching is disabled. */ locked?: boolean }) {
  const { mode, cloudModelId } = useInferenceSettings();
  const { activeId, models } = useModelManager();
  const [open, setOpen] = useState(false);
  const [confirmOffline, setConfirmOffline] = useState(false);
  const offline = mode === "local";

  const activeName = offline ? getLocalModel(activeId)?.name : getCloudModel(cloudModelId)?.name;
  const status = offline ? models[activeId] : undefined;
  const busy = status?.kind === "downloading" || status?.kind === "loading" || status?.kind === "checking";
  const TriggerIcon = busy ? LoaderCircleIcon : offline ? CpuIcon : CloudIcon;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Model: ${activeName ?? "none"}. Change model`}
            className="h-8 max-w-52 gap-1 px-2 text-xs text-muted-foreground"
          >
            <TriggerIcon className={cn(busy && "animate-spin")} />
            <span className="truncate">{activeName}</span>
            {status && (status.kind === "downloading" || status.kind === "loading") && (
              <span className="tabular-nums">{Math.round(status.progress * 100)}%</span>
            )}
            <ChevronDownIcon className="opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-1.5">
          <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
            {locked
              ? "Stop the current answer to switch models"
              : offline
                ? "Offline models run in your browser"
                : "Cloud models (Cloudflare Workers AI)"}
          </p>
          {offline ? (
            <ul aria-label="Models" className="space-y-0.5">
              {LOCAL_MODELS.map((model) => (
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
          ) : (
            <ul aria-label="Models" className="space-y-0.5">
              {CLOUD_MODELS.map((model) => {
                const active = model.id === cloudModelId;
                return (
                  <li key={model.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      disabled={locked && !active}
                      onClick={() => {
                        inferenceSettings.setCloudModel(model.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        locked && !active ? "cursor-not-allowed opacity-60" : "hover:bg-accent",
                      )}
                    >
                      <CheckIcon className={cn("mt-0.5 size-4 shrink-0", active ? "opacity-100" : "opacity-0")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{model.name}</span>
                        <span className="block text-xs text-muted-foreground">{model.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-1.5 border-t px-2 pt-2 pb-1">
            <button
              type="button"
              role="switch"
              aria-checked={offline}
              disabled={locked}
              onClick={() => {
                if (offline) {
                  enableCloudMode();
                } else {
                  setOpen(false);
                  setConfirmOffline(true);
                }
              }}
              className="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="font-medium">Offline / Private mode</span>
              <span
                aria-hidden
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
                  offline ? "bg-primary" : "bg-input",
                )}
              >
                <span
                  className={cn(
                    "inline-block size-4 rounded-full bg-background shadow transition-transform",
                    offline ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="privacy-note">
              <ShieldCheckIcon className="mt-px size-3.5 shrink-0" aria-hidden />
              {offline
                ? "The student's code stays in this browser. Nothing is sent to a server."
                : "Cloud mode sends the student's code to Cloudflare to grade it. Turn on Offline mode to keep it in this browser (one-time download)."}
            </p>
          </div>
        </PopoverContent>
      </Popover>
      <OfflineModeDialog open={confirmOffline} onOpenChange={setConfirmOffline} onConfirm={enableOfflineMode} />
    </>
  );
}
