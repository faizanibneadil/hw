"use client";

import { useEffect, useRef } from "react";

import { inferenceSettings } from "@/lib/ai/inference-settings";
import { turnstile } from "@/lib/ai/turnstile";

/**
 * Container for the Turnstile widget (cloud mode). It is invisible unless Cloudflare needs the
 * teacher to interact, in which case the checkbox appears above the prompt.
 */
export function TurnstileWidget() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The hydration pass renders with the server default (cloud): check the real setting.
    if (!ref.current || inferenceSettings.getState().mode !== "cloud") return;
    return turnstile.mount(ref.current);
  }, []);
  return (
    <div
      ref={ref}
      data-testid="turnstile"
      className="pointer-events-auto fixed bottom-28 left-1/2 z-40 -translate-x-1/2 empty:hidden"
    />
  );
}
