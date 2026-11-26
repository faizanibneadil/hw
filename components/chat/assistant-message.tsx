import type { MessageStatus } from "@/lib/db/types";
import { CopyButton } from "@/components/chat/copy-button";

interface AssistantMessageProps {
  text: string;
  streaming: boolean;
  status?: MessageStatus;
}

export function AssistantMessage({ text, streaming, status }: AssistantMessageProps) {
  return (
    <div className="group/assistant flex flex-col gap-1" data-role="assistant" aria-busy={streaming}>
      <div className="min-w-0 text-sm" data-testid="assistant-content">
        <pre className="whitespace-pre-wrap">{text}</pre>
      </div>
      {!streaming && text && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CopyButton text={text} label="Copy result" />
          {status === "stopped" && <span>Stopped</span>}
          {status === "error" && <span className="text-destructive">Incomplete (error)</span>}
        </div>
      )}
    </div>
  );
}
