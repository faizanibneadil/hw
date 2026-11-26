"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";

import type { ChatMessage } from "@/lib/db/types";
import { addMessage, createChat, getChatCode, makeTitle, newId, touchChat } from "@/lib/db/actions";
import { useCollections } from "@/lib/db/db-context";
import { createChatTransport, type ChatUIMessage } from "@/lib/ai/chat-transport";
import { lockedCodeFromFirstMessage } from "@/lib/ai/context";
import { modelManager } from "@/lib/ai/model-manager";
import { useModelManager } from "@/hooks/use-model-manager";
import { MessageList } from "@/components/chat/message-list";
import { ChatError } from "@/components/chat/chat-error";
import { ModelSelector } from "@/components/model/model-selector";
import { ModelStatusNotice } from "@/components/model/model-status-notice";
import { PromptInput, type PromptSubmission } from "@/components/prompt/prompt-input";

interface ChatSessionProps {
  chatId: string;
  persisted: boolean;
  dbMessages: ChatMessage[];
  onChatCreated: (id: string) => void;
}

function toUIMessage(message: ChatMessage): ChatUIMessage {
  return { id: message.id, role: message.role, parts: [{ type: "text", text: message.content }] };
}

function textOf(message: ChatUIMessage): string {
  return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
}

/** One open chat: `useChat` with the in-browser transport, persisted to IndexedDB. */
export function ChatSession({ chatId, persisted, dbMessages, onChatCreated }: ChatSessionProps) {
  const collections = useCollections();
  const { activeId, models } = useModelManager();

  // Initial messages come from IndexedDB once, when the chat opens.
  const [initialMessages] = useState(() =>
    dbMessages.filter((m) => m.content.trim() || m.role === "user").map(toUIMessage),
  );
  const [transport] = useState(() =>
    createChatTransport(() => {
      const code = getChatCode(collections, chatId);
      return lockedCodeFromFirstMessage(code.files, code.firstMessage);
    }),
  );

  const { messages, sendMessage, status, stop, error, regenerate, clearError } = useChat<ChatUIMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    experimental_throttle: 50,
    onFinish: ({ message, isAbort, isError, isDisconnect }) => {
      // The chat may have been deleted while the answer was streaming.
      if (message.role !== "assistant" || !collections.chats.has(chatId)) return;
      const content = textOf(message);
      if (!content.trim()) return;
      addMessage(collections, {
        id: message.id,
        chatId,
        role: "assistant",
        content,
        status: isAbort ? "stopped" : isError || isDisconnect ? "error" : "done",
      });
    },
  });

  // Leaving the chat (navigation, delete) stops its generation so the model worker is free.
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  });
  useEffect(() => () => void stopRef.current(), []);

  const dbById = useMemo(() => new Map(dbMessages.map((m) => [m.id, m])), [dbMessages]);
  const busy = status === "submitted" || status === "streaming";
  const modelReady = models[activeId]?.kind === "ready";

  const handleSubmit = useCallback(
    ({ markdown, files }: PromptSubmission) => {
      if (!persisted) {
        createChat(collections, {
          id: chatId,
          title: makeTitle(markdown, files.map((f) => f.name)),
          modelId: activeId,
          files,
        });
        onChatCreated(chatId);
      }
      const id = newId();
      addMessage(collections, {
        id,
        chatId,
        role: "user",
        content: markdown,
        status: "done",
        fileNames: files.length ? files.map((f) => f.name) : undefined,
      });
      touchChat(collections, chatId, { modelId: activeId });
      clearError();
      void sendMessage({ id, role: "user", parts: [{ type: "text", text: markdown }] });
    },
    [persisted, collections, chatId, activeId, onChatCreated, clearError, sendMessage],
  );

  return (
    <div className="flex h-full flex-col" data-testid="chat-area">
      <MessageList messages={messages} dbById={dbById} status={status}>
        {error && !busy && (
          <ChatError
            message={error.message}
            onRetry={() => {
              clearError();
              if (modelManager.getActiveModel()) void regenerate();
            }}
          />
        )}
      </MessageList>
      <ModelStatusNotice />
      <PromptInput
        isFirstMessage={messages.length === 0}
        busy={busy}
        sendBlockedReason={modelReady ? undefined : "The model is still loading. You can send once it is ready."}
        onSubmit={handleSubmit}
        onStop={() => void stop()}
        modelSelector={<ModelSelector locked={busy} />}
      />
    </div>
  );
}
