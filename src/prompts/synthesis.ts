import type { Turn } from "../transcript.js";
import { formatTranscriptForPrompt } from "../transcript.js";

export function buildSynthesisPrompt(
  goal: string,
  transcript: Turn[],
  reachedConsensus: boolean,
): string {
  return `You are summarizing a multi-agent discussion for the user who started it.

GOAL:
${goal}

CONSENSUS REACHED: ${reachedConsensus ? "yes" : "no (max turns hit)"}

FULL TRANSCRIPT:
${formatTranscriptForPrompt(transcript)}

Write a clear, tight synthesis for the user with these sections (plain markdown):

### Outcome
One or two sentences: what, if anything, the group decided. If no consensus, say
so and state the main fork.

### Key points
3-6 bullets covering the most load-bearing arguments and facts surfaced.

### Disagreements / open questions
Bullets only if real disagreements or open questions remain. Omit the section
otherwise — do not pad.

### Recommended next step
A single concrete action the user could take.

Do not invent facts that aren't in the transcript. Be specific, not diplomatic.`;
}

export function buildPersonaGenerationPrompt(
  goal: string,
  count: number,
  cwd: string,
): string {
  return `Generate ${count} distinct expert personas for a roundtable discussion.

DISCUSSION GOAL:
${goal}

CONTEXT: the discussion is happening in the repository at ${cwd}. Pick personas
whose expertise is directly relevant to the goal and who would productively
disagree with each other (different priorities, different risk tolerances,
different disciplines — not ${count} versions of the same archetype).

Respond with ONE LINE of strict JSON, no prose, no code fences, no trailing text:
[{"name": "<short role title>", "description": "<one sentence on their lens and priorities>"}, ...]

Exactly ${count} entries. Names must be unique and distinct.`;
}
