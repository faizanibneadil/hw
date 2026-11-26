"use client";

import { MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function MobileHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
      <Button variant="ghost" size="icon-sm" aria-label="Open chats" onClick={onOpenSidebar}>
        <MenuIcon />
      </Button>
      <span className="font-semibold">hw</span>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
