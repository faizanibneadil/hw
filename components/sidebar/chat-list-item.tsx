"use client";

import { useState } from "react";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Chat } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameChatDialog } from "@/components/sidebar/rename-chat-dialog";
import { DeleteChatDialog } from "@/components/sidebar/delete-chat-dialog";

interface ChatListItemProps {
  chat: Chat;
  active: boolean;
  onSelect: () => void;
  onDeleted: () => void;
}

export function ChatListItem({ chat, active, onSelect, onDeleted }: ChatListItemProps) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);

  return (
    <li
      className={cn(
        "group/item relative flex items-center rounded-md hover:bg-sidebar-accent",
        active && "bg-sidebar-accent font-medium",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "page" : undefined}
        className="min-w-0 flex-1 truncate rounded-md px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={chat.title}
      >
        {chat.title}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Options for ${chat.title}`}
            className="mr-1 shrink-0 opacity-100 md:opacity-0 md:group-hover/item:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("rename")}>
            <PencilIcon /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameChatDialog chat={chat} open={dialog === "rename"} onOpenChange={(o) => setDialog(o ? "rename" : null)} />
      <DeleteChatDialog
        chat={chat}
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        onDeleted={onDeleted}
      />
    </li>
  );
}
