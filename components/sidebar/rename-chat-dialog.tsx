"use client";

import { useState, type FormEvent } from "react";

import type { Chat } from "@/lib/db/types";
import { renameChat } from "@/lib/db/actions";
import { useCollections } from "@/lib/db/db-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RenameChatDialogProps {
  chat: Chat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameChatDialog({ chat, open, onOpenChange }: RenameChatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <RenameForm chat={chat} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ chat, onDone }: { chat: Chat; onDone: () => void }) {
  const collections = useCollections();
  const [title, setTitle] = useState(chat.title);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    renameChat(collections, chat.id, title);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Rename chat</DialogTitle>
        <DialogDescription>Give this chat a name you will recognise.</DialogDescription>
      </DialogHeader>
      <Input aria-label="Chat name" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={120} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!title.trim()}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
