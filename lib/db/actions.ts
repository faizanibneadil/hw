import type { Collections } from "@/lib/db/collections";
import type { Chat, ChatFile, ChatMessage } from "@/lib/db/types";

export function newId(): string {
  return crypto.randomUUID();
}

const MAX_TITLE = 60;

/** Title from the first prose line of the prompt (Markdown stripped), else from the first file name. */
export function makeTitle(prompt: string, fileNames: string[]): string {
  const firstLine =
    prompt
      .replace(/(```|~~~)[\s\S]*?(\1|$)/g, "\n")
      .split("\n")
      .map((line) =>
        line
          .replace(/^\s*(#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)/, "")
          .replace(/[*_`~]/g, "")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .find(Boolean) ?? "";
  const base = firstLine || fileNames[0] || "New chat";
  return base.length > MAX_TITLE ? `${base.slice(0, MAX_TITLE - 1).trimEnd()}…` : base;
}

export function createChat(
  collections: Collections,
  input: { id?: string; title: string; modelId: string; files: Omit<ChatFile, "id" | "chatId">[] },
): Chat {
  const now = Date.now();
  const chat: Chat = { id: input.id ?? newId(), title: input.title, createdAt: now, updatedAt: now, modelId: input.modelId };
  collections.chats.insert(chat);
  if (input.files.length) {
    collections.files.insert(input.files.map((file) => ({ ...file, id: newId(), chatId: chat.id })));
  }
  return chat;
}

export function addMessage(collections: Collections, message: Omit<ChatMessage, "id" | "createdAt"> & { id?: string }) {
  const full: ChatMessage = { createdAt: Date.now(), ...message, id: message.id ?? newId() };
  collections.messages.insert(full);
  touchChat(collections, message.chatId);
  return full;
}

export function touchChat(collections: Collections, chatId: string, patch: Partial<Pick<Chat, "modelId">> = {}) {
  if (!collections.chats.has(chatId)) return;
  collections.chats.update(chatId, (draft) => {
    draft.updatedAt = Date.now();
    if (patch.modelId) draft.modelId = patch.modelId;
  });
}

export function renameChat(collections: Collections, chatId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed || !collections.chats.has(chatId)) return;
  collections.chats.update(chatId, (draft) => {
    draft.title = trimmed.slice(0, 120);
  });
}

/** Deletes a chat together with its messages and files. */
export function deleteChat(collections: Collections, chatId: string) {
  const messageIds = [...collections.messages.state.values()].filter((m) => m.chatId === chatId).map((m) => m.id);
  const fileIds = [...collections.files.state.values()].filter((f) => f.chatId === chatId).map((f) => f.id);
  if (messageIds.length) collections.messages.delete(messageIds);
  if (fileIds.length) collections.files.delete(fileIds);
  if (collections.chats.has(chatId)) collections.chats.delete(chatId);
}

/** The student's code for a chat: files from the first message + code blocks in the first message. */
export function getChatCode(collections: Collections, chatId: string) {
  const files = [...collections.files.state.values()]
    .filter((f) => f.chatId === chatId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, language, content }) => ({ name, language, content }));
  const firstUser = [...collections.messages.state.values()]
    .filter((m) => m.chatId === chatId && m.role === "user")
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  return { files, firstMessage: firstUser?.content };
}
