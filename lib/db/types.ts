export type MessageRole = "user" | "assistant";
export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface Chat {
  id: string;
  title: string;
  /** epoch ms */
  createdAt: number;
  /** epoch ms; bumped on every new message so the sidebar sorts by activity */
  updatedAt: number;
  modelId: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: MessageRole;
  /** Markdown */
  content: string;
  createdAt: number;
  status: MessageStatus;
  /** File names attached to this message (user messages only; first message of a chat). */
  fileNames?: string[];
  /** Error text when status is "error". */
  error?: string;
}

export interface ChatFile {
  id: string;
  chatId: string;
  name: string;
  language: string;
  content: string;
  /** bytes */
  size: number;
}
