export class FirstEventTimeoutError extends Error {
  constructor(public readonly timeoutMs: number, public readonly label?: string) {
    super(
      `First-event timeout after ${timeoutMs}ms${label ? ` (${label})` : ""}`,
    );
    this.name = "FirstEventTimeoutError";
  }
}

export interface ErrorClassification {
  retryable: boolean;
  category: "timeout" | "aborted" | "auth" | "rate_limit" | "crash" | "unknown";
}

export function classifyError(err: unknown): ErrorClassification {
  if (err instanceof FirstEventTimeoutError) {
    return { retryable: false, category: "timeout" };
  }
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes("aborted") || msg.includes("abortsignal")) {
    return { retryable: false, category: "aborted" };
  }
  if (
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("invalid api key") ||
    msg.includes("authentication")
  ) {
    return { retryable: false, category: "auth" };
  }
  if (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("429") ||
    msg.includes("overloaded") ||
    msg.includes("529")
  ) {
    return { retryable: true, category: "rate_limit" };
  }
  if (
    msg.includes("exited with code") ||
    msg.includes("killed") ||
    msg.includes("signal") ||
    msg.includes("socket hang up") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  ) {
    return { retryable: true, category: "crash" };
  }
  return { retryable: false, category: "unknown" };
}
