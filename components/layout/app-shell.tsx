"use client";

import { useState, type ReactNode } from "react";

import { useIsMobile } from "@/hooks/use-is-mobile";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { MobileHeader } from "@/components/layout/mobile-header";

interface AppShellProps {
  /** Renders the sidebar; `onNavigate` closes the mobile sheet after a selection. */
  sidebar: (onNavigate: () => void, options: { inSheet: boolean }) => ReactNode;
  children: ReactNode;
}

/** Two-panel layout: resizable sidebar on desktop, sheet on mobile (closed by default). */
export function AppShell({ sidebar, children }: AppShellProps) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile === undefined) {
    return <div className="h-dvh bg-background" />;
  }

  if (isMobile) {
    return (
      <div className="flex h-dvh flex-col">
        <MobileHeader onOpenSidebar={() => setSheetOpen(true)} />
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-80 gap-0 bg-sidebar p-0">
            <SheetTitle className="sr-only">Chats</SheetTitle>
            <SheetDescription className="sr-only">Your saved chats</SheetDescription>
            {sidebar(() => setSheetOpen(false), { inSheet: true })}
          </SheetContent>
        </Sheet>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-dvh">
      <ResizablePanel id="sidebar" defaultSize="280px" minSize="200px" maxSize="480px" className="bg-sidebar">
        {sidebar(() => undefined, { inSheet: false })}
      </ResizablePanel>
      <ResizableHandle withHandle aria-label="Resize sidebar" />
      <ResizablePanel id="chat" minSize="320px">
        <main className="h-full min-w-0">{children}</main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
