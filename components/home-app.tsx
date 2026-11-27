"use client";

import { useEffect } from "react";

import { modelManager } from "@/lib/ai/model-manager";
import { useInferenceSettings } from "@/hooks/use-inference-settings";
import { DbProvider } from "@/lib/db/db-context";
import { useActiveChat } from "@/hooks/use-active-chat";
import { AppShell } from "@/components/layout/app-shell";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ChatArea } from "@/components/chat/chat-area";
import { DbStatus } from "@/components/layout/db-status";
import { MarkdownTheme } from "@/components/markdown/markdown-theme";
import { TurnstileWidget } from "@/components/chat/turnstile-widget";

/** Client root of the app. */
export function HomeApp() {
  const { mode } = useInferenceSettings();
  useEffect(() => {
    // Offline mode only: detect WebGPU, check the cache and load the model. In cloud mode
    // (default) nothing is downloaded and no model worker is started.
    if (mode === "local") void modelManager.init();
  }, [mode]);

  return (
    <>
      <h1 className="sr-only">hw: homework checker</h1>
      <MarkdownTheme />
      {mode === "cloud" && <TurnstileWidget />}
      <DbProvider fallback={(state) => <DbStatus state={state} />}>
        <App />
      </DbProvider>
    </>
  );
}

function App() {
  const [activeChatId, setActiveChatId] = useActiveChat();

  return (
    <AppShell
      sidebar={(onNavigate, { inSheet }) => (
        <AppSidebar
          showThemeToggle={!inSheet}
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
