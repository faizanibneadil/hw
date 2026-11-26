import type { CacheCheckRequest, CacheCheckResponse } from "@/workers/cache.worker";

const TIMEOUT_MS = 8000;

/**
 * Checks the Transformers.js browser cache for several models in a short-lived worker.
 * A check that fails or takes too long counts as "not downloaded" (the Download button still works).
 */
export async function checkModelsCached(
  requests: Omit<CacheCheckRequest, "requestId">[],
): Promise<boolean[]> {
  if (!requests.length) return [];
  const worker = new Worker(new URL("../../workers/cache.worker.ts", import.meta.url), { type: "module" });
  try {
    return await Promise.all(
      requests.map(
        (request, requestId) =>
          new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => resolve(false), TIMEOUT_MS);
            const onMessage = (event: MessageEvent<CacheCheckResponse>) => {
              if (event.data.requestId !== requestId) return;
              worker.removeEventListener("message", onMessage);
              clearTimeout(timer);
              // A failed check only means "unknown": treat as not downloaded.
              resolve("cached" in event.data ? event.data.cached : false);
            };
            worker.addEventListener("message", onMessage);
            worker.postMessage({ ...request, requestId } satisfies CacheCheckRequest);
          }),
      ),
    );
  } finally {
    worker.terminate();
  }
}
