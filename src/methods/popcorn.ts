import type { RoomConfig } from "../config.js";
import type { Persona, Turn } from "../transcript.js";
import { runQuery } from "../sdk/query.js";
import { LIGHT_MODEL, META_TOOLS, PERSONA_TOOLS } from "../models.js";
import {
  buildPersonaSystemPrompt,
  buildPersonaTurnPrompt,
} from "../prompts/persona.js";
import { buildPopcornRouterPrompt } from "../prompts/popcornRouter.js";
import { buildDecisionCheckPrompt } from "../prompts/decision.js";
import { printPersonaHeader, printMeta, ui } from "../ui.js";
import { extractJsonObject, META_MAX_TURNS, PERSONA_MAX_TURNS, parseDecision } from "./_shared.js";

export async function runPopcorn(
  cfg: RoomConfig,
  personas: Persona[],
  cwd: string,
): Promise<{ transcript: Turn[]; reachedConsensus: boolean }> {
  const transcript: Turn[] = [];
  let reachedConsensus = false;
  let spokenThisCycle = new Set<string>();

  for (let turnIndex = 0; turnIndex < cfg.maxTurns; turnIndex++) {
    if (spokenThisCycle.size >= personas.length) {
      spokenThisCycle = new Set<string>();
    }
    const available = personas.filter((p) => !spokenThisCycle.has(p.name));

    let next: Persona;
    if (available.length === 1 || transcript.length === 0) {
      next = available[0];
      printMeta(`  ${ui.yellow("popcorn-router:")} ${next.name} (only option / opener)`);
    } else {
      const routerRaw = await runQuery({
        prompt: buildPopcornRouterPrompt(cfg.goal, transcript, available),
        cwd,
        model: LIGHT_MODEL,
        allowedTools: META_TOOLS,
        maxTurns: META_MAX_TURNS,
        label: "popcorn-router",
        silent: true,
      });
      const obj = extractJsonObject(routerRaw);
      const chosen =
        obj && typeof obj.nextSpeaker === "string"
          ? available.find((p) => p.name === obj.nextSpeaker)
          : undefined;
      next = chosen ?? available[0];
      const reason = obj?.reason ?? "(router unparseable; fell back)";
      printMeta(`  ${ui.yellow("popcorn-router:")} ${next.name} — ${reason}`);
    }

    printPersonaHeader(next.name, turnIndex);
    const text = await runQuery({
      prompt: buildPersonaTurnPrompt(transcript),
      systemPrompt: buildPersonaSystemPrompt(next, personas, cfg.goal, cwd),
      cwd,
      model: cfg.model,
      allowedTools: PERSONA_TOOLS,
      maxTurns: PERSONA_MAX_TURNS,
      label: next.name,
      silent: cfg.silent,
    });
    transcript.push({ persona: next.name, text: text.trim() });
    spokenThisCycle.add(next.name);

    const cycleComplete = spokenThisCycle.size >= personas.length;
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
