// Shared by the Next.js app and the Worker (`worker/index.ts`): keep this file dependency-free
// and use relative imports only.

export type ModelDtype = "q4" | "q4f16" | "q8" | "fp16" | "fp32";
export type ModelKind = "cloud" | "local";
export type ReasoningEffort = "low" | "medium" | "high";

interface BaseModelConfig {
  id: string;
  name: string;
  kind: ModelKind;
  /** Context window used for history trimming (tokens). */
  contextTokens: number;
}

/** A Workers AI model, run by the Worker (`POST /api/chat`). */
export interface CloudModelConfig extends BaseModelConfig {
  kind: "cloud";
  /** Short description shown in the selector. */
  description: string;
  /** Sent as `reasoning_effort`; keeps thinking short so the answer fits in MAX_OUTPUT_TOKENS. */
  reasoningEffort: ReasoningEffort;
}

/** A Transformers.js model that runs in the browser (Offline / Private mode). */
export interface LocalModelConfig extends BaseModelConfig {
  kind: "local";
  /** Approximate download size, shown in the selector. */
  sizeLabel: string;
  dtype: ModelDtype;
  /** Model cannot run on WASM/CPU (too slow or needs fp16 shaders). */
  requiresWebGPU: boolean;
}

export type ModelConfig = CloudModelConfig | LocalModelConfig;

/**
 * Workers AI models (all available on the Workers Free plan). The first entry is the default.
 * Ids and context windows are from the Workers AI model catalog. The Worker allowlists exactly these.
 */
export const CLOUD_MODELS: CloudModelConfig[] = [
  {
    id: "@cf/zai-org/glm-4.7-flash",
    name: "GLM 4.7 Flash",
    kind: "cloud",
    description: "Fast, good default",
    contextTokens: 131072,
    reasoningEffort: "low",
  },
  {
    id: "@cf/google/gemma-4-26b-a4b-it",
    name: "Gemma 4 26B",
    kind: "cloud",
    description: "Google, balanced",
    contextTokens: 256000,
    reasoningEffort: "low",
  },
  {
    // Replaces @cf/nvidia/nemotron-3-120b-a12b, which Workers AI deprecated on 2026-11-20 (see PLAN.md).
    id: "@cf/qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B",
    kind: "cloud",
    description: "Largest, uses the daily quota fastest",
    contextTokens: 262144,
    reasoningEffort: "low",
  },
];

/** In-browser models, ordered smallest first; the first entry is loaded when Offline mode is turned on. */
export const LOCAL_MODELS: LocalModelConfig[] = [
  {
    id: "onnx-community/Qwen2.5-Coder-0.5B-Instruct",
    name: "Qwen2.5 Coder 0.5B",
    kind: "local",
    sizeLabel: "~790 MB",
    dtype: "q4",
    requiresWebGPU: false,
    contextTokens: 16384,
  },
  {
    id: "onnx-community/Qwen2.5-Coder-1.5B-Instruct",
    name: "Qwen2.5 Coder 1.5B",
    kind: "local",
    sizeLabel: "~1.3 GB",
    dtype: "q4f16",
    requiresWebGPU: true,
    contextTokens: 16384,
  },
];

export const MODELS: ModelConfig[] = [...CLOUD_MODELS, ...LOCAL_MODELS];

export const DEFAULT_CLOUD_MODEL_ID = CLOUD_MODELS[0].id;
export const DEFAULT_LOCAL_MODEL_ID = LOCAL_MODELS[0].id;

/** Tokens reserved for the answer. */
export const MAX_OUTPUT_TOKENS = 1536;

export function getModelConfig(id: string): ModelConfig | undefined {
  return MODELS.find((model) => model.id === id);
}

export function getCloudModel(id: string): CloudModelConfig | undefined {
  return CLOUD_MODELS.find((model) => model.id === id);
}

export function getLocalModel(id: string): LocalModelConfig | undefined {
  return LOCAL_MODELS.find((model) => model.id === id);
}
