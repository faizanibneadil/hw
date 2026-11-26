"use client";

import { useLiveQuery } from "@tanstack/react-db";
import { eq } from "@tanstack/db";

import { useCollections } from "@/lib/db/db-context";
import { addMessage, createChat, makeTitle } from "@/lib/db/actions";
import { EmptyState } from "@/components/chat/empty-state";
import { UserMessage } from "@/components/chat/user-message";
import { PromptInput, type PromptSubmission } from "@/components/prompt/prompt-input";

interface ChatAreaProps {
  chatId: string | null;
  onChatCreated: (id: string) => void;
}

export function ChatArea({ chatId, onChatCreated }: ChatAreaProps) {
  const collections = useCollections();
  const { data: messages } = useLiveQuery((q) =>
    q
      .from({ message: collections.messages })
      .where(({ message }) => eq(message.chatId, chatId ?? ""))
      .orderBy(({ message }) => message.createdAt, "asc"),
  );

  function handleSubmit({ markdown, files }: PromptSubmission) {
    let id = chatId;
    if (!id) {
      const chat = createChat(collections, {
        title: makeTitle(markdown, files.map((f) => f.name)),
        modelId: "",
        files,
      });
      id = chat.id;
      onChatCreated(id);
    }
    addMessage(collections, {
      chatId: id,
      role: "user",
      content: markdown,
      status: "done",
      fileNames: files.length ? files.map((f) => f.name) : undefined,
    });
  }

  return (
    <div className="flex h-full flex-col" data-testid="chat-area">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
            {messages.map((message) => (
              <UserMessage key={message.id} fileNames={message.fileNames}>
                <pre className="text-sm whitespace-pre-wrap">{message.content}</pre>
              </UserMessage>
            ))}
          </div>
        )}
      </div>
      <PromptInput
        key={chatId ?? "new"}
        isFirstMessage={messages.length === 0}
        busy={false}
        onSubmit={handleSubmit}
        onStop={() => undefined}
      />
    </div>
  );
}
