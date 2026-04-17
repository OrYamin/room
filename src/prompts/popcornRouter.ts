import type { Persona, Turn } from "../transcript.js";
import { formatTranscriptForPrompt } from "../transcript.js";

export function buildPopcornRouterPrompt(
  goal: string,
  transcript: Turn[],
  available: Persona[],
): string {
  const list = available.map((p) => `  - ${p.name}: ${p.description}`).join("\n");
  return `You are routing turns in a multi-agent discussion ("popcorn" mode:
every persona must speak once per cycle before anyone repeats).

GOAL:
${goal}

TRANSCRIPT SO FAR:
${formatTranscriptForPrompt(transcript)}

PERSONAS STILL TO SPEAK THIS CYCLE:
${list}

Pick the single best next speaker from the list above, based on who would most
naturally advance the conversation right now (e.g., whose expertise addresses
the most recent point, who has been directly challenged, who should react to
new information).

Respond with ONE LINE of strict JSON, no prose, no code fences:
{"nextSpeaker": "<exact name from the list>", "reason": "<one short sentence>"}`;
}
