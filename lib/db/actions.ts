import type { Collections } from "@/lib/db/collections";
import type { Chat, ChatFile, ChatMessage } from "@/lib/db/types";

export function newId(): string {
  return crypto.randomUUID();
}

const MAX_TITLE = 60;

/** Title from the first prompt (Markdown stripped), else from the first file name. */
export function makeTitle(prompt: string, fileNames: string[]): string {
  const text = prompt
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/[#>*_`~[\]()|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = text || fileNames[0] || "New chat";
  return base.length > MAX_TITLE ? `${base.slice(0, MAX_TITLE - 1).trimEnd()}…` : base;
}

export function createChat(
  collections: Collections,
  input: { title: string; modelId: string; files: Omit<ChatFile, "id" | "chatId">[] },
): Chat {
  const now = Date.now();
  const chat: Chat = { id: newId(), title: input.title, createdAt: now, updatedAt: now, modelId: input.modelId };
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
