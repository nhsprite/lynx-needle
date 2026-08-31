// Source of the lynx-needle npm package: loader + high-level wrapper over
// the `needle` Lynx NAPI addon.
//
// Usage inside a Lynx page:
//   import { loadNeedle } from "lynx-needle";
//   const needle = await loadNeedle();
//   needle.init(systemPrompt, tools);
//   const result = await needle.run("dim the living room to 30", handlers);
//
// The addon itself exports the raw engine surface:
//   init(system, tools, toolIndexPath?) / complete(input, maxNewTokens?) -> Promise
//   reset() / load(cactPath) / engineVersion()
// The wrapper adds the agent loop (run) and one-shot extraction (extract),
// mirroring the Python `cactus-needle` API.

/** JSON-Schema-flavored tool declaration consumed by the engine. */
export interface NeedleTool {
  name: string;
  description?: string;
  parameters?: {
    type: "object";
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** A single tool call decided by the model. */
export interface NeedleFunctionCall {
  name: string;
  /** Parsed arguments object — grammar-guaranteed to match the schema. */
  arguments: Record<string, unknown>;
}

/** Response envelope written by the engine for every `complete` call. */
export interface NeedleResponse {
  /** "call": model requests tool execution; "respond": loop finished. */
  type: "call" | "respond" | string;
  success: boolean;
  error: string | null;
  error_code: string | null;
  reason?: string | null;
  function_calls: NeedleFunctionCall[];
  reasoning?: string;
  /** Calibrated score in [0,1]; null when tuned (LoRA) weights are loaded. */
  confidence: number | null;
  prefill_tps?: number;
  decode_tps?: number;
  peak_ram_mb?: number;
  /** Grounding/negation validation report emitted by the engine. */
  validation?: { ungrounded: string[]; negation: boolean };
}

/** Raw exports of the native addon (`__lynx_node_addon_exports__.needle`). */
export interface NeedleAddon {
  /**
   * (Re)initialize the global session. `tools` may be a schema array or a
   * pre-serialized JSON string. `toolIndexPath` persists the tool-embedding
   * index used by the retrieval head when more than 5 tools are declared.
   */
  init(system: string, tools: NeedleTool[] | string, toolIndexPath?: string): void;
  /** Runs inference off the JS thread; resolves with the parsed envelope. */
  complete(input: string, maxNewTokens?: number): Promise<NeedleResponse>;
  /** Rewind the conversation; tool declarations are kept. */
  reset(): void;
  /**
   * Bind a tuned `.cact` archive (LoRA merged + quantized). One-way: the
   * engine cannot unload weights for the process lifetime, and `confidence`
   * becomes uncalibrated (reported as null).
   */
  load(cactPath: string): void;
  /** Engine revision this addon links against, e.g. "2.0.3". */
  engineVersion(): string;
}

export interface NeedleRunOptions {
  maxSteps?: number;
  maxNewTokens?: number;
}

export interface NeedleRunResult extends NeedleResponse {
  /** Results of every executed tool call, in execution order. */
  results: unknown[];
}

export type NeedleToolHandler = (
  args: Record<string, unknown>
) => unknown | Promise<unknown>;

export interface NeedleAgent extends NeedleAddon {
  /**
   * Agent loop: complete -> execute handlers -> feed results back, until the
   * model stops calling tools or `maxSteps` is reached.
   */
  run(
    query: string,
    handlers?: Record<string, NeedleToolHandler>,
    options?: NeedleRunOptions
  ): Promise<NeedleRunResult>;
  /** One-shot structured extraction: `schema` is declared as the only tool. */
  extract(
    text: string,
    schema: NeedleTool,
    options?: { system?: string; maxNewTokens?: number }
  ): Promise<Record<string, unknown> | null>;
}

/** Lynx NAPI addon globals published by the host-side loader. */
declare global {
  // eslint-disable-next-line no-var
  var __lynx_node_addon_exports__: Record<string, unknown> | undefined;
}

// Lynx injects `NativeModules` as a bundle-scope identifier (an AMD factory
// parameter), NOT as a real global — it must be referenced as a bare
// identifier with a `typeof` guard, never via globalThis.
declare const NativeModules:
  | { LynxNodeAPI?: { requireNodeAddon(name: string): void } }
  | undefined;

// The Lynx JS runtime provides these; they are not part of lib.es2017.
declare const console: { error(...args: unknown[]): void };
declare function setTimeout(cb: (...args: never[]) => void, ms: number): unknown;

/**
 * Load the addon through the Lynx host bridge and wrap it. Returns null when
 * the addon is not available (host not integrated / NAPI not enabled).
 *
 * The bridge call is async fire-and-forget, so we poll for the exports
 * object that the native loader publishes on globalThis.
 */
export async function loadNeedle(timeoutMs = 3000): Promise<NeedleAgent | null> {
  const bridge =
    typeof NativeModules !== "undefined" ? NativeModules?.LynxNodeAPI : undefined;
  if (!bridge) {
    console.error("[needle] LynxNodeAPI bridge missing");
    return null;
  }
  try {
    bridge.requireNodeAddon("needle");
  } catch (e) {
    console.error("[needle] requireNodeAddon threw:", String(e));
    return null;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const addon = globalThis.__lynx_node_addon_exports__?.needle as
      | NeedleAddon
      | undefined;
    if (addon) {
      return createNeedle(addon);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  console.error("[needle] exports did not appear within", timeoutMs, "ms");
  return null;
}

export function createNeedle(addon: NeedleAddon): NeedleAgent {
  if (!addon) {
    throw new Error("needle addon not loaded; call requireNodeAddon('needle') first");
  }

  async function run(
    query: string,
    handlers: Record<string, NeedleToolHandler> = {},
    options: NeedleRunOptions = {}
  ): Promise<NeedleRunResult> {
    const maxSteps = options.maxSteps ?? 8;
    const maxNewTokens = options.maxNewTokens ?? 256;
    let response = await addon.complete(query, maxNewTokens);
    const executed: unknown[] = [];
    for (let step = 0; step < maxSteps; step++) {
      const calls = response.function_calls || [];
      if (response.type !== "call" || calls.length === 0) break;
      const results: unknown[] = [];
      for (const call of calls) {
        const fn = handlers[call.name];
        if (typeof fn !== "function") {
          results.push({ error: "unknown tool: " + String(call.name) });
          continue;
        }
        try {
          results.push(await fn(call.arguments || {}));
        } catch (err) {
          results.push({ error: String(err instanceof Error ? err.message : err) });
        }
      }
      executed.push(...results);
      response = await addon.complete(JSON.stringify(results), maxNewTokens);
    }
    return { ...response, results: executed };
  }

  async function extract(
    text: string,
    schema: NeedleTool,
    options: { system?: string; maxNewTokens?: number } = {}
  ): Promise<Record<string, unknown> | null> {
    // One-shot extraction: declare the schema as the only tool.
    addon.init(options.system ?? "", [schema]);
    const response = await addon.complete(text, options.maxNewTokens ?? 256);
    const calls = response.function_calls || [];
    if (calls.length === 0) return null;
    return calls[0].arguments || {};
  }

  return {
    init: addon.init.bind(addon),
    complete: addon.complete.bind(addon),
    reset: addon.reset.bind(addon),
    load: addon.load.bind(addon),
    engineVersion: addon.engineVersion.bind(addon),
    run,
    extract,
  };
}
