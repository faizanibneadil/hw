"use client";

import { SquarePenIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ChatList } from "@/components/sidebar/chat-list";

interface AppSidebarProps {
  /** Hidden inside the mobile sheet (the mobile header has one, and the sheet has a close button there). */
  showThemeToggle: boolean;
  activeChatId: string | null;
  onSelectChat: (id: string | null) => void;
}

export function AppSidebar({ showThemeToggle, activeChatId, onSelectChat }: AppSidebarProps) {
  return (
    <nav aria-label="Chats" className="flex h-full flex-col text-sidebar-foreground">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-3">
        <span className="font-semibold tracking-tight">hw</span>
        {showThemeToggle && <ThemeToggle />}
      </div>
      <div className="px-2 pb-2">
        <Button variant="outline" className="w-full justify-start" onClick={() => onSelectChat(null)}>
          <SquarePenIcon /> New chat
        </Button>
      </div>
      <ChatList activeChatId={activeChatId} onSelectChat={onSelectChat} />
    </nav>
  );
}
