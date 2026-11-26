"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Active chat id, kept in the URL hash (`#<chatId>`) so reloads reopen the same chat. */
function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function read(): string | null {
  const id = decodeURIComponent(window.location.hash.slice(1));
  return id || null;
}

export function useActiveChat(): [string | null, (id: string | null) => void] {
  const activeId = useSyncExternalStore(subscribe, read, () => null);
  const setActiveId = useCallback((id: string | null) => {
    const url = id ? `#${encodeURIComponent(id)}` : window.location.pathname + window.location.search;
    window.history.pushState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);
  return [activeId, setActiveId];
}
