"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/** Keeps a scroll container pinned to the bottom while content grows, unless the user scrolled up. */
export function useStickToBottom<T extends HTMLElement>(dependency: unknown) {
  const ref = useRef<T>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [dependency]);

  return ref;
}
