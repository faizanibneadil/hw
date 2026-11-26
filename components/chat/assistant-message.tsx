import type { MessageStatus } from "@/lib/db/types";
import { CopyButton } from "@/components/chat/copy-button";
import { MarkdownContent } from "@/components/markdown/markdown-content";

interface AssistantMessageProps {
  text: string;
  streaming: boolean;
  status?: MessageStatus;
}

export function AssistantMessage({ text, streaming, status }: AssistantMessageProps) {
  return (
    <div className="group/assistant flex flex-col gap-1" data-role="assistant" aria-busy={streaming}>
      <div className="min-w-0" data-testid="assistant-content">
        <MarkdownContent streaming={streaming}>{text}</MarkdownContent>
      </div>
      {!streaming && text && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CopyButton text={text} label="Copy result" />
          {status === "stopped" && <span>Stopped</span>}
          {status === "error" && <span className="text-destructive-text">Incomplete (error)</span>}
        </div>
      )}
    </div>
  );
}
