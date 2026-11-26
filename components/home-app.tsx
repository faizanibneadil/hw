"use client";

import { useEffect } from "react";

import { modelManager } from "@/lib/ai/model-manager";
import { DbProvider } from "@/lib/db/db-context";
import { useActiveChat } from "@/hooks/use-active-chat";
import { AppShell } from "@/components/layout/app-shell";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { DbStatus } from "@/components/layout/db-status";

/** Client root of the app. */
export function HomeApp() {
  useEffect(() => {
    // Usable immediately: detect WebGPU, check the cache and auto-load the smallest model.
    void modelManager.init();
  }, []);

  return (
    <DbProvider fallback={(state) => <DbStatus state={state} />}>
      <App />
    </DbProvider>
  );
}

function App() {
  const [activeChatId, setActiveChatId] = useActiveChat();

  return (
    <AppShell
      sidebar={(onNavigate) => (
        <AppSidebar
          activeChatId={activeChatId}
          onSelectChat={(id) => {
            setActiveChatId(id);
            onNavigate();
          }}
        />
      )}
    >
      <ChatArea chatId={activeChatId} onChatCreated={setActiveChatId} />
    </AppShell>
  );
}
