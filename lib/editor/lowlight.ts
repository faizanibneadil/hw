import { common, createLowlight } from "lowlight";

/** Shared lowlight instance with highlight.js' common languages (≈37, incl. all offered in the selector). */
export const lowlight = createLowlight(common);
