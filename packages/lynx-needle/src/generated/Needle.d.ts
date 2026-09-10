export interface NeedleResponse {
  type: string;
  success: boolean;
  error: string | null;
  error_code: string | null;
  reason?: string | null;
  function_calls: Array<Record<string, unknown>>;
  reasoning?: string;
  confidence: number | null;
  prefill_tps?: number;
  decode_tps?: number;
  peak_ram_mb?: number;
  validation?: Record<string, unknown>;
}

export interface NeedleSpec {
  init(system: string, tools: unknown, toolIndexPath?: string): void;
  complete(input: string, maxNewTokens?: number): Promise<unknown>;
  reset(): void;
  load(cactPath: string): void;
  engineVersion(): string;
}

export declare function requireNeedle(): NeedleSpec;
export declare const Needle: NeedleSpec;
export default Needle;
