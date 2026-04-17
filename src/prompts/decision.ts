import type { Turn } from "../transcript.js";
import { formatTranscriptForPrompt } from "../transcript.js";

export function buildDecisionCheckPrompt(
  goal: string,
  transcript: Turn[],
  threshold: number,
): string {
  return `You are a neutral discussion judge. Below is the goal of a roundtable
and the transcript so far. Assess whether the participants have reached a
concrete, actionable consensus that resolves the goal.

Consensus means: at least one clear position is stated, the main tradeoffs have
been surfaced, no participant's latest turn contains unresolved strong
objections, and the group would plausibly act on the outcome.

GOAL:
${goal}

TRANSCRIPT:
${formatTranscriptForPrompt(transcript)}

Respond with ONE LINE of strict JSON, no prose, no code fences:
{"confidence": <number between 0 and 1>, "reason": "<one short sentence>"}

The threshold to stop the discussion is ${threshold}. Only return a confidence
>= ${threshold} if the consensus is genuinely clear and specific.`;
}
