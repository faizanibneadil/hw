/// <reference lib="webworker" />
// Runs model loading and inference off the main thread (handler from @browser-ai/transformers-js).
import { TransformersJSWorkerHandler } from "@browser-ai/transformers-js";

const handler = new TransformersJSWorkerHandler();
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
