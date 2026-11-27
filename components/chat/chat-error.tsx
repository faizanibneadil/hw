"use client";

import { useState } from "react";
import { CircleAlertIcon, CpuIcon, RotateCwIcon } from "lucide-react";

import { describeChatError } from "@/lib/ai/chat-errors";
import { Button } from "@/components/ui/button";
import { OfflineModeDialog } from "@/components/model/offline-mode-dialog";

interface ChatErrorProps {
  error: Error;
  onRetry: () => void;
  /** Offer "Switch to Offline mode" (cloud quota used up). Called after the teacher confirmed. */
  onSwitchToOffline?: () => void;
  /** Offline mode was turned on from here and the message is sent again once the model is ready. */
  waitingForOffline?: boolean;
}

/** Error under the messages: a plain-English explanation, Retry and (for the daily quota) Offline mode. */
export function ChatError({ error, onRetry, onSwitchToOffline, waitingForOffline }: ChatErrorProps) {
  const [confirming, setConfirming] = useState(false);
  const info = describeChatError(error);
  const canSwitch = info.code === "QUOTA_EXCEEDED" && onSwitchToOffline;

  return (
    <div
      role="alert"
      data-error-code={info.code}
      className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive-text sm:flex-row sm:items-start"
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          {info.message}
          {waitingForOffline && <span className="block pt-1">Offline mode is on. Your message is sent again once the model is ready.</span>}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap gap-2">
        {canSwitch && !waitingForOffline && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setConfirming(true)}>
            <CpuIcon /> Switch to Offline mode
          </Button>
        )}
        {!waitingForOffline && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onRetry}>
            <RotateCwIcon /> Retry
          </Button>
        )}
      </span>
      {canSwitch && (
        <OfflineModeDialog
          open={confirming}
          onOpenChange={setConfirming}
          onConfirm={onSwitchToOffline}
          detail="Your message is sent again once the model is ready."
        />
      )}
    </div>
  );
}
