import { DEFAULT_CLOUD_MODEL_ID, getCloudModel } from "@/lib/ai/models";

/**
 * - `cloud` (default): grading runs on Cloudflare Workers AI through `POST /api/chat`. No download.
 * - `local`: Offline / Private mode. The model is downloaded once and runs in the browser.
 */
export type InferenceMode = "cloud" | "local";

export interface InferenceSettings {
  mode: InferenceMode;
  cloudModelId: string;
}

const STORAGE_KEY = "hw-inference-settings";
const DEFAULTS: InferenceSettings = { mode: "cloud", cloudModelId: DEFAULT_CLOUD_MODEL_ID };

function readStored(): InferenceSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<InferenceSettings>;
    return {
      mode: parsed.mode === "local" ? "local" : "cloud",
      cloudModelId: parsed.cloudModelId && getCloudModel(parsed.cloudModelId) ? parsed.cloudModelId : DEFAULT_CLOUD_MODEL_ID,
    };
  } catch {
    return DEFAULTS;
  }
}

function writeStored(settings: InferenceSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked (private mode, quota): the choice only lasts for this page load.
  }
}

/** TEST ONLY: `?e2e=mock&mode=local|cloud` forces the mode for the e2e suite. */
function testModeOverride(): InferenceMode | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("e2e") !== "mock") return null;
  const mode = params.get("mode");
  return mode === "local" || mode === "cloud" ? mode : null;
}

class InferenceSettingsStore {
  private state: InferenceSettings = DEFAULTS;
  private loaded = false;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): InferenceSettings => {
    if (!this.loaded && typeof window !== "undefined") {
      this.loaded = true;
      const stored = readStored();
      const override = testModeOverride();
      this.state = override ? { ...stored, mode: override } : stored;
    }
    return this.state;
  };

  getServerState = (): InferenceSettings => DEFAULTS;

  private set(patch: Partial<InferenceSettings>) {
    this.state = { ...this.getState(), ...patch };
    writeStored(this.state);
    this.listeners.forEach((listener) => listener());
  }

  setMode(mode: InferenceMode) {
    if (mode !== this.getState().mode) this.set({ mode });
  }

  setCloudModel(id: string) {
    if (getCloudModel(id) && id !== this.getState().cloudModelId) this.set({ cloudModelId: id });
  }
}

export const inferenceSettings = new InferenceSettingsStore();
