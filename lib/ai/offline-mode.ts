import { inferenceSettings } from "@/lib/ai/inference-settings";
import { modelManager } from "@/lib/ai/model-manager";

/**
 * Turns Offline / Private mode on (after the teacher confirmed the download): from now on the
 * chat uses the in-browser model, which is downloaded once (~790 MB) and then cached.
 */
export function enableOfflineMode() {
  inferenceSettings.setMode("local");
  void modelManager.init();
}

export function enableCloudMode() {
  inferenceSettings.setMode("cloud");
}
