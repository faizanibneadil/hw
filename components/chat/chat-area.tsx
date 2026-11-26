"use client";

import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "@tanstack/db";

import { useCollections } from "@/lib/db/db-context";

interface ChatAreaProps {
  chatId: string | null;
  onChatCreated: (id: string) => void;
}

/** Placeholder chat area (the chat view is built in the next steps). */
export function ChatArea({ chatId }: ChatAreaProps) {
  const { chats } = useCollections();
  const { data: chat } = useLiveQuery((q) =>
    q
      .from({ chat: chats })
      .where(({ chat }) => eq(chat.id, chatId ?? ""))
      .findOne(),
  );

  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground" data-testid="chat-area">
      {chat ? chat.title : "Add the student's code and say what to check."}
    </div>
  );
}
