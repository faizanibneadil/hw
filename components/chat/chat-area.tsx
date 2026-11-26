"use client";

import { useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "@tanstack/db";

import { newId } from "@/lib/db/actions";
import { useCollections } from "@/lib/db/db-context";
import { ChatSession } from "@/components/chat/chat-session";

interface ChatAreaProps {
  chatId: string | null;
  onChatCreated: (id: string) => void;
}

/**
 * Chooses the chat to show. A new chat gets a client-side id up front so the session
 * (and a running stream) survives the moment the chat is first saved.
 */
export function ChatArea({ chatId, onChatCreated }: ChatAreaProps) {
  const [draftId, setDraftId] = useState(newId);
  const sessionId = chatId ?? draftId;

  return (
    <ChatLoader
      key={sessionId}
      chatId={sessionId}
      persisted={chatId !== null}
      onChatCreated={(id) => {
        onChatCreated(id);
        setDraftId(newId());
      }}
    />
  );
}

interface ChatLoaderProps {
  chatId: string;
  persisted: boolean;
  onChatCreated: (id: string) => void;
}

/** Waits for the chat's messages, then mounts the session with them as initial `useChat` messages. */
function ChatLoader({ chatId, persisted, onChatCreated }: ChatLoaderProps) {
  const { messages } = useCollections();
  const { data, isReady } = useLiveQuery((q) =>
    q
      .from({ message: messages })
      .where(({ message }) => eq(message.chatId, chatId))
      .orderBy(({ message }) => message.createdAt, "asc"),
  );

  if (!isReady) return <div className="h-full" data-testid="chat-area" aria-busy="true" />;
  return <ChatSession chatId={chatId} persisted={persisted} dbMessages={data} onChatCreated={onChatCreated} />;
}
