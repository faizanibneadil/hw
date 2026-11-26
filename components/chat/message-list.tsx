"use client";

import type { ReactNode } from "react";
import type { ChatStatus } from "ai";

import type { ChatMessage } from "@/lib/db/types";
import type { ChatUIMessage } from "@/lib/ai/chat-transport";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { AssistantMessage } from "@/components/chat/assistant-message";
import { EmptyState } from "@/components/chat/empty-state";
import { MarkdownContent } from "@/components/markdown/markdown-content";
import { ThinkingIndicator } from "@/components/chat/thinking-indicator";
import { UserMessage } from "@/components/chat/user-message";

interface MessageListProps {
  messages: ChatUIMessage[];
  dbById: Map<string, ChatMessage>;
  status: ChatStatus;
  children?: ReactNode;
}

function textOf(message: ChatUIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

export function MessageList({ messages, dbById, status, children }: MessageListProps) {
  const last = messages.at(-1);
  const scrollRef = useStickToBottom<HTMLDivElement>(`${messages.length}:${last ? textOf(last).length : 0}:${status}`);

  if (messages.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EmptyState />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {messages.map((message, index) => {
          const text = textOf(message);
          const stored = dbById.get(message.id);
          if (message.role === "user") {
            return (
              <UserMessage key={message.id} fileNames={stored?.fileNames}>
                <MarkdownContent>{text}</MarkdownContent>
              </UserMessage>
            );
          }
          const streaming = status === "streaming" && index === messages.length - 1;
          return <AssistantMessage key={message.id} text={text} streaming={streaming} status={stored?.status} />;
        })}
        {status === "submitted" && <ThinkingIndicator />}
        {children}
      </div>
    </div>
  );
}
