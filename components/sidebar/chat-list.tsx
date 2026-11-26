"use client";

import { useLiveQuery } from "@tanstack/react-db";

import { useCollections } from "@/lib/db/db-context";
import { ChatListItem } from "@/components/sidebar/chat-list-item";

interface ChatListProps {
  activeChatId: string | null;
  onSelectChat: (id: string | null) => void;
}

/** All chats, newest activity first, updated live from IndexedDB. */
export function ChatList({ activeChatId, onSelectChat }: ChatListProps) {
  const { chats } = useCollections();
  const { data } = useLiveQuery((q) => q.from({ chat: chats }).orderBy(({ chat }) => chat.updatedAt, "desc"));

  if (!data.length) {
    return <p className="px-4 py-2 text-sm text-muted-foreground">No chats yet.</p>;
  }

  return (
    <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
      {data.map((chat) => (
        <ChatListItem
          key={chat.id}
          chat={chat}
          active={chat.id === activeChatId}
          onSelect={() => onSelectChat(chat.id)}
          onDeleted={() => chat.id === activeChatId && onSelectChat(null)}
        />
      ))}
    </ul>
  );
}
