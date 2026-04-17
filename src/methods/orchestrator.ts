import type { RoomConfig } from "../config.js";
import type { Persona, Turn } from "../transcript.js";
import { runQuery } from "../sdk/query.js";
import { META_TOOLS, ORCHESTRATOR_MODEL, PERSONA_TOOLS } from "../models.js";
import {
  buildPersonaSystemPrompt,
  buildPersonaTurnPrompt,
} from "../prompts/persona.js";
import { buildOrchestratorPrompt } from "../prompts/orchestrator.js";
import { printHeader, printPersonaHeader, printMeta, ui } from "../ui.js";
import { extractJsonObject, META_MAX_TURNS, PERSONA_MAX_TURNS } from "./_shared.js";

export async function runOrchestrator(
  cfg: RoomConfig,
  personas: Persona[],
  cwd: string,
): Promise<{
  transcript: Turn[];
  reachedConsensus: boolean;
  orchestratorSummary?: string;
}> {
  const transcript: Turn[] = [];
  let reachedConsensus = false;
  let orchestratorSummary: string | undefined;

  for (let turnIndex = 0; turnIndex < cfg.maxTurns; turnIndex++) {
    const turnsLeft = cfg.maxTurns - turnIndex;
    const routerRaw = await runQuery({
      prompt: buildOrchestratorPrompt(
        cfg.goal,
        personas,
        transcript,
        cfg.threshold,
        turnsLeft,
      ),
      cwd,
      model: ORCHESTRATOR_MODEL,
      allowedTools: META_TOOLS,
      maxTurns: META_MAX_TURNS,
      label: "orchestrator",
      silent: true,
    });
    const decision = extractJsonObject(routerRaw);
    if (!decision) {
      printMeta(
        `  ${ui.yellow("orchestrator:")} unparseable response; stopping. raw=${routerRaw.slice(0, 200)}`,
      );
      break;
    }

    if (decision.decisionReached === true) {
      reachedConsensus = true;
      orchestratorSummary =
        typeof decision.summary === "string" ? decision.summary : undefined;
      printHeader("Orchestrator: consensus reached");
      if (orchestratorSummary) {
        process.stdout.write(`${orchestratorSummary}\n`);
      }
      break;
    }

    const nextName =
      typeof decision.nextSpeaker === "string" ? decision.nextSpeaker : undefined;
    const next =
      (nextName && personas.find((p) => p.name === nextName)) ?? personas[0];
    const direction =
      typeof decision.direction === "string" ? decision.direction : undefined;

    printMeta(
      `  ${ui.yellow("orchestrator:")} next=${next.name}${direction ? ` — ${direction}` : ""}`,
    );
    printPersonaHeader(next.name, turnIndex);

    const text = await runQuery({
      prompt: buildPersonaTurnPrompt(transcript, direction),
      systemPrompt: buildPersonaSystemPrompt(next, personas, cfg.goal, cwd),
      cwd,
      model: cfg.model,
      allowedTools: PERSONA_TOOLS,
      maxTurns: PERSONA_MAX_TURNS,
      label: next.name,
      silent: cfg.silent,
    });
    transcript.push({ persona: next.name, text: text.trim() });
  }

  return { transcript, reachedConsensus, orchestratorSummary };
}
