export type ModelDtype = "q4" | "q4f16" | "q8" | "fp16" | "fp32";

export interface ModelConfig {
  id: string;
  name: string;
  /** Approximate download size, shown in the selector. */
  sizeLabel: string;
  dtype: ModelDtype;
  /** Model cannot run on WASM/CPU (too slow or needs fp16 shaders). */
  requiresWebGPU: boolean;
  /** Context window used for history trimming (tokens). */
  contextTokens: number;
}

/** Ordered smallest first; the first entry is downloaded and loaded automatically. */
export const MODELS: ModelConfig[] = [
  {
    id: "onnx-community/Qwen2.5-Coder-0.5B-Instruct",
    name: "Qwen2.5 Coder 0.5B",
    sizeLabel: "~790 MB",
    dtype: "q4",
    requiresWebGPU: false,
    contextTokens: 16384,
  },
  {
    id: "onnx-community/Qwen2.5-Coder-1.5B-Instruct",
    name: "Qwen2.5 Coder 1.5B",
    sizeLabel: "~1.3 GB",
    dtype: "q4f16",
    requiresWebGPU: true,
    contextTokens: 16384,
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

/** Tokens reserved for the answer. */
export const MAX_OUTPUT_TOKENS = 1536;

export function getModelConfig(id: string): ModelConfig | undefined {
  return MODELS.find((model) => model.id === id);
}
