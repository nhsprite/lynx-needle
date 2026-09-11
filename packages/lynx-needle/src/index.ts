// Public entry of the lynx-needle package. Implementation lives in
// needle.ts; this barrel keeps the package's main/exports stable when the
// source is split into more modules later.
export * from "./needle.js";
export { Needle, requireNeedle } from "./generated/Needle.js";
export type { NeedleSpec } from "./generated/Needle.js";
