import { createCollection, createIndexedDB, indexedDBCollectionOptions } from "@tanstack/db";

import type { Chat, ChatFile, ChatMessage } from "@/lib/db/types";

const DB_NAME = "hw";
const DB_VERSION = 1;

function createCollections(db: Awaited<ReturnType<typeof createIndexedDB>>) {
  return {
    chats: createCollection(
      indexedDBCollectionOptions<Chat, string>({
        db,
        name: "chats",
        id: "chats",
        getKey: (chat) => chat.id,
      }),
    ),
    messages: createCollection(
      indexedDBCollectionOptions<ChatMessage, string>({
        db,
        name: "messages",
        id: "messages",
        getKey: (message) => message.id,
      }),
    ),
    files: createCollection(
      indexedDBCollectionOptions<ChatFile, string>({
        db,
        name: "files",
        id: "files",
        getKey: (file) => file.id,
      }),
    ),
  };
}

export type Collections = ReturnType<typeof createCollections>;

let collectionsPromise: Promise<Collections> | null = null;

/** Opens the IndexedDB database once (browser only) and creates the collections. */
export function getCollections(): Promise<Collections> {
  if (!collectionsPromise) {
    collectionsPromise = (async () => {
      const db = await createIndexedDB({
        name: DB_NAME,
        version: DB_VERSION,
        stores: ["chats", "messages", "files"],
      });
      const collections = createCollections(db);
      await Promise.all([
        collections.chats.preload(),
        collections.messages.preload(),
        collections.files.preload(),
      ]);
      return collections;
    })();
    collectionsPromise.catch(() => {
      collectionsPromise = null;
    });
  }
  return collectionsPromise;
}
