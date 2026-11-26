interface GpuLike {
  requestAdapter: () => Promise<unknown>;
}

/** True when WebGPU is exposed and an adapter can actually be obtained. */
export async function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const gpu = (navigator as Navigator & { gpu?: GpuLike }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}
