import { DEFENSIVE_DISALLOWED } from "../models.js";

export interface BuildOptionsArgs {
  cwd: string;
  model: string;
  systemPrompt?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  maxTurns?: number;
  permissionMode?: string;
  abortController: AbortController;
}

export function buildBaseOptions(args: BuildOptionsArgs): Record<string, any> {
  const {
    cwd,
    model,
    systemPrompt,
    allowedTools,
    disallowedTools,
    maxTurns,
    permissionMode,
    abortController,
  } = args;

  const disallowed = Array.from(
    new Set([...(disallowedTools ?? []), ...DEFENSIVE_DISALLOWED]),
  );

  // `tools` gates the WHOLE tool registry (--tools on the CLI).
  // `allowedTools` is only the auto-approve list and does nothing to stop
  // the model from *trying* to call tools — which, under the Claude Code
  // preset, it will do until --max-turns kills it.
  // We always pass `tools` explicitly so the model sees exactly the toolkit
  // we intend (empty for meta calls).
  const tools = allowedTools ?? [];

  const opts: Record<string, any> = {
    cwd,
    model,
    abortController,
    permissionMode: permissionMode ?? "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    tools,
    allowedTools: tools,
    disallowedTools: disallowed,
  };

  if (maxTurns !== undefined) {
    opts.maxTurns = maxTurns;
  }

  // Always override the SDK's default Claude Code preset — we don't want the
  // built-in tool-using agent persona for either meta calls or persona turns.
  // Meta calls (no allowedTools) get a minimal "just answer" prompt.
  // Persona turns must pass their own systemPrompt.
  opts.systemPrompt =
    systemPrompt !== undefined
      ? systemPrompt
      : "You are a helpful assistant. Follow the user's instructions literally. If asked for JSON, respond with only the JSON, no prose, no code fences.";

  return opts;
}
