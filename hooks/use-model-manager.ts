"use client";

import { useSyncExternalStore } from "react";

import { modelManager, type ModelManagerState } from "@/lib/ai/model-manager";

/** Live model manager state (download progress, active model, WebGPU support). */
export function useModelManager(): ModelManagerState {
  return useSyncExternalStore(modelManager.subscribe, modelManager.getState, modelManager.getState);
}
