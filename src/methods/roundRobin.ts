import type { RoomConfig } from "../config.js";
import type { Persona, Turn } from "../transcript.js";
import { runQuery } from "../sdk/query.js";
import { LIGHT_MODEL, META_TOOLS, PERSONA_TOOLS } from "../models.js";
import {
  buildPersonaSystemPrompt,
  buildPersonaTurnPrompt,
} from "../prompts/persona.js";
import { buildDecisionCheckPrompt } from "../prompts/decision.js";
import { printPersonaHeader, printMeta, ui } from "../ui.js";
import { META_MAX_TURNS, PERSONA_MAX_TURNS, parseDecision } from "./_shared.js";

export async function runRoundRobin(
  cfg: RoomConfig,
  personas: Persona[],
  cwd: string,
): Promise<{ transcript: Turn[]; reachedConsensus: boolean }> {
  const transcript: Turn[] = [];
  let reachedConsensus = false;

  for (let turnIndex = 0; turnIndex < cfg.maxTurns; turnIndex++) {
    const persona = personas[turnIndex % personas.length];
    printPersonaHeader(persona.name, turnIndex);

    const text = await runQuery({
      prompt: buildPersonaTurnPrompt(transcript),
      systemPrompt: buildPersonaSystemPrompt(persona, personas, cfg.goal, cwd),
      cwd,
      model: cfg.model,
      allowedTools: PERSONA_TOOLS,
      maxTurns: PERSONA_MAX_TURNS,
      label: persona.name,
      silent: cfg.silent,
    });
    transcript.push({ persona: persona.name, text: text.trim() });

    const cycleComplete = (turnIndex + 1) % personas.length === 0;
    if (cycleComplete && turnIndex + 1 < cfg.maxTurns) {
      const decisionRaw = await runQuery({
        prompt: buildDecisionCheckPrompt(cfg.goal, transcript, cfg.threshold),
        cwd,
        model: LIGHT_MODEL,
        allowedTools: META_TOOLS,
        maxTurns: META_MAX_TURNS,
        label: "decision-check",
        silent: true,
      });
      const decision = parseDecision(decisionRaw);
      printMeta(
        `  ${ui.yellow("decision-check:")} confidence=${decision.confidence.toFixed(2)} reason=${decision.reason}`,
      );
      if (decision.confidence >= cfg.threshold) {
        reachedConsensus = true;
        break;
      }
    }
  }

  return { transcript, reachedConsensus };
}
