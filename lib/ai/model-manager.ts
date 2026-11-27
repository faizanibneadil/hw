import type { LanguageModelV4 } from "@ai-sdk/provider";

import { DEFAULT_LOCAL_MODEL_ID, LOCAL_MODELS, getLocalModel, type LocalModelConfig } from "@/lib/ai/models";
import { detectWebGPU } from "@/lib/ai/webgpu";
import { checkModelsCached } from "@/lib/ai/model-cache";
import { createMockModel, isMockMode } from "@/lib/ai/mock-model";

export type ModelStatus =
  | { kind: "checking" }
  | { kind: "unsupported"; reason: string }
  | { kind: "not-downloaded" }
  /** First download (files are fetched and the model is loaded). */
  | { kind: "downloading"; progress: number }
  /** Files are in the browser cache, model not in memory. */
  | { kind: "downloaded" }
  /** Loading an already downloaded model into memory. */
  | { kind: "loading"; progress: number }
  /** Loaded and ready to generate. */
  | { kind: "ready" }
  | { kind: "error"; message: string; wasDownloaded: boolean };

export interface ModelManagerState {
  /** null while detecting. */
  webgpu: boolean | null;
  activeId: string;
  models: Record<string, ModelStatus>;
}

interface Instance {
  model: LanguageModelV4;
  worker?: Worker;
}

/** Selectable = fully downloaded (possibly loading into memory or loaded). */
export function isSelectable(status: ModelStatus | undefined): boolean {
  return status?.kind === "downloaded" || status?.kind === "loading" || status?.kind === "ready";
}

function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text || "Unknown error";
}

const MOCK_CACHE_KEY = "hw-e2e-mock-cache";
const LOCAL_MODEL_KEY = "hw-local-model";

function readLocalModelChoice(): string {
  try {
    const id = window.localStorage.getItem(LOCAL_MODEL_KEY);
    return id && getLocalModel(id) ? id : DEFAULT_LOCAL_MODEL_ID;
  } catch {
    return DEFAULT_LOCAL_MODEL_ID;
  }
}

function writeLocalModelChoice(id: string) {
  try {
    window.localStorage.setItem(LOCAL_MODEL_KEY, id);
  } catch {
    // Storage blocked: the choice only lasts for this page load.
  }
}

/**
 * In-browser models for Offline / Private mode. Nothing happens (no download, no worker, no
 * transformers.js code loaded) until `init()` is called, which only happens when the teacher
 * turns Offline mode on.
 */

class ModelManager {
  private state: ModelManagerState = {
    webgpu: null,
    activeId: DEFAULT_LOCAL_MODEL_ID,
    models: Object.fromEntries(LOCAL_MODELS.map((m) => [m.id, { kind: "checking" } satisfies ModelStatus])),
  };
  private listeners = new Set<() => void>();
  private instances = new Map<string, Instance>();
  private pending = new Map<string, Promise<void>>();
  private initialized = false;
  private mock = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private set(patch: Partial<ModelManagerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private setStatus(id: string, status: ModelStatus) {
    this.set({ models: { ...this.state.models, [id]: status } });
  }

  private status(id: string): ModelStatus | undefined {
    return this.state.models[id];
  }

  get isInitialized() {
    return this.initialized;
  }

  /**
   * Detects WebGPU, checks which models are cached and loads the last used model if it is cached,
   * otherwise the default (smallest) one.
   */
  async init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.mock = isMockMode();

    const webgpu = this.mock ? new URLSearchParams(window.location.search).get("webgpu") !== "0" : await detectWebGPU();
    this.set({ webgpu });

    const supported = LOCAL_MODELS.filter((m) => webgpu || !m.requiresWebGPU);
    for (const model of LOCAL_MODELS) {
      if (!supported.includes(model)) {
        this.setStatus(model.id, { kind: "unsupported", reason: "Needs WebGPU, which this browser does not provide." });
      }
    }

    let cached: boolean[];
    if (this.mock) {
      const list = this.readMockCache();
      cached = supported.map((m) => list.includes(m.id));
    } else {
      cached = await checkModelsCached(
        supported.map((m) => ({ modelId: m.id, dtype: m.dtype, device: webgpu ? "webgpu" : "wasm" })),
      ).catch(() => supported.map(() => false));
    }
    supported.forEach((model, i) => this.setStatus(model.id, { kind: cached[i] ? "downloaded" : "not-downloaded" }));

    const preferred = readLocalModelChoice();
    void this.activate(isSelectable(this.status(preferred)) ? preferred : DEFAULT_LOCAL_MODEL_ID);
  }

  /** The model used for generation, or null when the active model is not ready. */
  getActiveModel(): LanguageModelV4 | null {
    if (this.status(this.state.activeId)?.kind !== "ready") return null;
    return this.instances.get(this.state.activeId)?.model ?? null;
  }

  /** Downloads a model (without selecting it). */
  download(id: string): Promise<void> {
    const status = this.status(id);
    if (status?.kind !== "not-downloaded" && status?.kind !== "error") return this.pending.get(id) ?? Promise.resolve();
    return this.loadInstance(id);
  }

  /** Selects a downloaded model as the active one and loads it into memory. */
  select(id: string) {
    if (!isSelectable(this.status(id)) || id === this.state.activeId) return;
    void this.activate(id);
  }

  retry(id: string) {
    if (id === this.state.activeId) void this.activate(id);
    else void this.download(id);
  }

  private async activate(id: string) {
    const previous = this.state.activeId;
    this.set({ activeId: id });
    writeLocalModelChoice(id);
    if (previous !== id) this.unload(previous);
    const status = this.status(id);
    if (status?.kind === "ready" || status?.kind === "unsupported") return;
    await this.loadInstance(id);
  }

  /** Frees a model's memory (terminates its worker); its files stay cached. */
  private unload(id: string) {
    const instance = this.instances.get(id);
    if (!instance || this.pending.has(id)) return;
    instance.worker?.terminate();
    this.instances.delete(id);
    if (this.status(id)?.kind === "ready") this.setStatus(id, { kind: "downloaded" });
  }

  private loadInstance(id: string): Promise<void> {
    const existing = this.pending.get(id);
    if (existing) return existing;
    const config = getLocalModel(id);
    if (!config) return Promise.resolve();

    const wasDownloaded = this.status(id)?.kind === "downloaded" || (this.status(id)?.kind === "error" && this.wasDownloaded(id));
    const progressKind = wasDownloaded ? "loading" : "downloading";
    this.setStatus(id, { kind: progressKind, progress: 0 });

    const run = (async () => {
      try {
        const instance = this.mock ? await this.createMockInstance(id) : await this.createInstance(config, (p) => {
          const current = this.status(id);
          const progress = Math.max(0, Math.min(1, p));
          if (current?.kind === progressKind && progress > current.progress) this.setStatus(id, { kind: progressKind, progress });
        });
        if (this.state.activeId === id) {
          this.instances.set(id, instance);
          this.setStatus(id, { kind: "ready" });
        } else {
          // Downloaded in the background: keep the files cached but free the memory.
          instance.worker?.terminate();
          this.setStatus(id, { kind: "downloaded" });
        }
      } catch (error) {
        this.setStatus(id, { kind: "error", message: errorMessage(error), wasDownloaded });
      } finally {
        this.pending.delete(id);
      }
    })();
    this.pending.set(id, run);
    return run;
  }

  private wasDownloaded(id: string) {
    const status = this.status(id);
    return status?.kind === "error" && status.wasDownloaded;
  }

  private async createInstance(config: LocalModelConfig, onProgress: (p: number) => void): Promise<Instance> {
    // Loaded on demand so cloud-mode users never download the transformers.js code.
    const { transformersJS } = await import("@browser-ai/transformers-js");
    const worker = new Worker(new URL("../../workers/llm.worker.ts", import.meta.url), { type: "module" });
    try {
      const model = transformersJS(config.id, {
        device: this.state.webgpu ? "webgpu" : "wasm",
        dtype: config.dtype,
        worker,
      });
      await model.createSessionWithProgress(onProgress);
      return { model, worker };
    } catch (error) {
      worker.terminate();
      throw error;
    }
  }

  private async createMockInstance(id: string): Promise<Instance> {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fail") === id) throw new Error("Mock download failed");
    for (let step = 1; step <= 10; step++) {
      await new Promise((r) => setTimeout(r, Number(params.get("delay") ?? 60)));
      const current = this.status(id);
      if (current?.kind === "downloading" || current?.kind === "loading") {
        this.setStatus(id, { ...current, progress: step / 10 });
      }
    }
    const list = this.readMockCache();
    if (!list.includes(id)) sessionStorage.setItem(MOCK_CACHE_KEY, JSON.stringify([...list, id]));
    return { model: createMockModel(id) };
  }

  private readMockCache(): string[] {
    try {
      return JSON.parse(sessionStorage.getItem(MOCK_CACHE_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  }
}

export const modelManager = new ModelManager();
