"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const NEAR_BOTTOM = 80;

/**
 * Keeps a scroll container pinned to the bottom while content grows, unless the user scrolled up.
 * Returns a callback ref, so it also works when the container mounts later (e.g. after an empty state).
 */
export function useStickToBottom<T extends HTMLElement>(dependency: unknown) {
  const [element, setElement] = useState<T | null>(null);
  const pinned = useRef(true);
  /** scrollTop right after our last automatic scroll. */
  const autoTop = useRef(0);

  useEffect(() => {
    if (!element) return;
    pinned.current = true;
    autoTop.current = 0;
    const onScroll = () => {
      const fromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      if (fromBottom < NEAR_BOTTOM) pinned.current = true;
      else if (element.scrollTop < autoTop.current - 2) pinned.current = false;
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [element]);

  useLayoutEffect(() => {
    if (!element) return;
    // The user moved up since our last automatic scroll (the scroll event may not have fired yet).
    if (element.scrollTop < autoTop.current - 2) pinned.current = false;
    if (!pinned.current) return;
    element.scrollTo({ top: element.scrollHeight });
    autoTop.current = element.scrollTop;
  }, [element, dependency]);

  return useCallback((node: T | null) => setElement(node), []);
}
