"use client";

import { useSyncExternalStore } from "react";

import { inferenceSettings, type InferenceSettings } from "@/lib/ai/inference-settings";

/** Live inference settings (cloud / offline mode and the chosen cloud model). */
export function useInferenceSettings(): InferenceSettings {
  return useSyncExternalStore(inferenceSettings.subscribe, inferenceSettings.getState, inferenceSettings.getServerState);
}
