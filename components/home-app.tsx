"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeToggle } from "@/components/theme/theme-toggle";

/** Client root of the app. */
export function HomeApp() {
  return (
    <AppShell
      sidebar={() => (
        <div className="flex h-full flex-col p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">hw</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    >
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chat</div>
    </AppShell>
  );
}
