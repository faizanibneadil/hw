/// <reference lib="webworker" />
// Answers "is this model already in the browser cache?" using Transformers.js' ModelRegistry.
import { ModelRegistry } from "@huggingface/transformers";

type IsCachedOptions = NonNullable<Parameters<typeof ModelRegistry.is_cached>[1]>;

export interface CacheCheckRequest {
  requestId: number;
  modelId: string;
  dtype: string;
  device: "webgpu" | "wasm";
}

export type CacheCheckResponse = { requestId: number; cached: boolean } | { requestId: number; error: string };

self.onmessage = async (event: MessageEvent<CacheCheckRequest>) => {
  const { requestId, modelId, dtype, device } = event.data;
  try {
    const cached = await ModelRegistry.is_cached(modelId, {
      dtype: dtype as IsCachedOptions["dtype"],
      device,
    });
    self.postMessage({ requestId, cached } satisfies CacheCheckResponse);
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : String(error) } satisfies CacheCheckResponse);
  }
};
