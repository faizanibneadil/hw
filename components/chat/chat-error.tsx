import { CircleAlertIcon, RotateCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ChatError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onRetry}>
        <RotateCwIcon /> Retry
      </Button>
    </div>
  );
}
