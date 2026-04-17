import type { Persona, Turn } from "../transcript.js";
import { formatTranscriptForPrompt } from "../transcript.js";

export function buildOrchestratorPrompt(
  goal: string,
  personas: Persona[],
  transcript: Turn[],
  threshold: number,
  turnsLeft: number,
): string {
  const list = personas.map((p) => `  - ${p.name}: ${p.description}`).join("\n");
  return `You are the orchestrator of a multi-agent discussion. Your job is to
(a) judge whether the group has reached a concrete, actionable consensus that
resolves the goal, and (b) if not, pick the next speaker and give them a
specific direction for their turn.

GOAL:
${goal}

PERSONAS:
${list}

TRANSCRIPT SO FAR:
${formatTranscriptForPrompt(transcript)}

TURNS REMAINING (including this one): ${turnsLeft}
CONSENSUS THRESHOLD: ${threshold}

If consensus is reached: set decisionReached=true and write a crisp summary of
the decision (what was chosen, the main rationale, any caveats) in "summary".
Otherwise: pick the persona (by exact name) whose turn will most advance the
discussion, and write a 1-2 sentence "direction" telling them what to focus on
or push back against. Be willing to direct personas to challenge each other —
don't let the discussion stall in polite agreement.

Respond with ONE LINE of strict JSON, no prose, no code fences:
{"decisionReached": <bool>, "summary": "<string, only if decisionReached=true>", "nextSpeaker": "<exact persona name, only if decisionReached=false>", "direction": "<string, only if decisionReached=false>"}`;
}
