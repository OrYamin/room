import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildBaseOptions } from "./options.js";
import { extractAssistantText, extractResultText } from "./stream.js";
import { classifyError, FirstEventTimeoutError } from "./errors.js";
import { ui, printError, printMeta } from "../ui.js";

export interface RunQueryArgs {
  prompt: string;
  cwd: string;
  model: string;
  systemPrompt?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: string;
  maxTurns?: number;
  silent?: boolean;
  label?: string;
  firstEventTimeoutMs?: number;
  maxRetries?: number;
  onText?: (chunk: string) => void;
}

const DEFAULT_FIRST_EVENT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function* withFirstMessageTimeout<T>(
  gen: AsyncIterable<T>,
  controller: AbortController,
  timeoutMs: number,
  label?: string,
): AsyncGenerator<T> {
  const iterator = (gen as any)[Symbol.asyncIterator]();
  let timer: NodeJS.Timeout | undefined;
  const firstPromise = iterator.next();
  const timeoutPromise = new Promise<{ done: true; timedOut: true }>((resolve) => {
    timer = setTimeout(() => resolve({ done: true, timedOut: true }), timeoutMs);
  });
  const first = await Promise.race([firstPromise, timeoutPromise]);
  if (timer) clearTimeout(timer);
  if ((first as any).timedOut) {
    controller.abort();
    throw new FirstEventTimeoutError(timeoutMs, label);
  }
  const firstResult = first as IteratorResult<T>;
  if (firstResult.done) return;
  yield firstResult.value;
  while (true) {
    const next = await iterator.next();
    if (next.done) return;
    yield next.value;
  }
}

function emitChunk(
  chunk: string,
  previousEmitted: string,
  label: string | undefined,
  onText: ((c: string) => void) | undefined,
  silent: boolean,
): string {
  // chunks are cumulative text per assistant message; emit only the delta
  if (!chunk) return previousEmitted;
  let delta = chunk;
  if (previousEmitted && chunk.startsWith(previousEmitted)) {
    delta = chunk.slice(previousEmitted.length);
  }
  if (!delta) return chunk;
  if (onText) {
    onText(delta);
  } else if (!silent) {
    process.stdout.write(delta);
  }
  return chunk;
}

export async function runQuery(args: RunQueryArgs): Promise<string> {
  const maxRetries = args.maxRetries ?? DEFAULT_MAX_RETRIES;
  const firstEventTimeoutMs =
    args.firstEventTimeoutMs ?? DEFAULT_FIRST_EVENT_TIMEOUT_MS;
  const silent = args.silent ?? false;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const options = buildBaseOptions({
      cwd: args.cwd,
      model: args.model,
      systemPrompt: args.systemPrompt,
      allowedTools: args.allowedTools,
      disallowedTools: args.disallowedTools,
      maxTurns: args.maxTurns,
      permissionMode: args.permissionMode,
      abortController: controller,
    });

    try {
      const stream: any = query({ prompt: args.prompt, options });
      const wrapped = withFirstMessageTimeout(
        stream,
        controller,
        firstEventTimeoutMs,
        args.label,
      );

      let lastAssistantText = "";
      let finalText = "";
      for await (const message of wrapped) {
        const m: any = message;
        const type = m?.type;
        if (type === "assistant") {
          const text = extractAssistantText(m);
          if (text) {
            lastAssistantText = emitChunk(
              text,
              lastAssistantText,
              args.label,
              args.onText,
              silent,
            );
            finalText = text;
          }
          if (m?.error) {
            printMeta(
              `[${args.label ?? "room"}] assistant error: ${m.error}`,
            );
          }
        } else if (type === "result") {
          const resultText = extractResultText(m);
          if (resultText) finalText = resultText;
          if (m?.is_error || m?.subtype !== "success") {
            const errs = Array.isArray(m?.errors) ? m.errors.join("; ") : "";
            printMeta(
              `[${args.label ?? "room"}] result subtype=${m?.subtype ?? "?"} is_error=${!!m?.is_error}${errs ? ` errors=${errs}` : ""}`,
            );
          }
          if (!silent && !args.onText) process.stdout.write("\n");
          return finalText;
        }
      }
      if (!silent && !args.onText) process.stdout.write("\n");
      return finalText;
    } catch (err) {
      lastErr = err;
      const classification = classifyError(err);
      const msg = err instanceof Error ? err.message : String(err);
      if (classification.retryable && attempt < maxRetries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        printMeta(
          `[${args.label ?? "room"}] transient error (${classification.category}), retrying in ${delay}ms: ${msg}`,
        );
        await sleep(delay);
        continue;
      }
      printError(
        `[${args.label ?? "room"}] ${classification.category} error: ${msg}`,
      );
      throw err;
    }
  }
  throw lastErr;
}
