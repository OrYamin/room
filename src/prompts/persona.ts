import type { Persona, Turn } from "../transcript.js";
import { formatTranscriptForPrompt } from "../transcript.js";

export function buildPersonaSystemPrompt(
  persona: Persona,
  allPersonas: Persona[],
  goal: string,
  cwd: string,
): string {
  const others = allPersonas
    .filter((p) => p.name !== persona.name)
    .map((p) => `  - ${p.name}: ${p.description}`)
    .join("\n");

  return `You are ${persona.name}.
Role: ${persona.description}

You are one of ${allPersonas.length} experts in a roundtable discussion.

GOAL OF THE DISCUSSION:
${goal}

OTHER PARTICIPANTS (do NOT roleplay them):
${others || "  (none — you are solo)"}

WORKING DIRECTORY (the user's repo): ${cwd}

=== RULES ===
- Speak ONLY as ${persona.name}, in the first person. Never write dialogue for
  other participants.
- Keep turns tight: 3-8 sentences unless a deep technical dive is essential.
- Ground claims in the real code at the working directory above: use Read,
  Glob, and Grep to check before asserting. Cite file paths when relevant.
- You may use WebSearch / WebFetch for external facts; cite sources briefly.
- You are READ-ONLY. You must not edit, write, or run anything.
- Engage with what others have said. Push back when you disagree; concede
  when convinced; surface real tradeoffs instead of platitudes.
- End your turn with either a concrete position, a concrete question to the
  group, or a concrete next-step proposal. No filler.
- Do NOT announce your name at the start — the system already labels turns.`;
}

export function buildPersonaTurnPrompt(
  transcript: Turn[],
  direction?: string,
): string {
  const parts: string[] = [];
  parts.push("=== TRANSCRIPT SO FAR ===");
  parts.push(formatTranscriptForPrompt(transcript));
  parts.push("");
  if (direction && direction.trim()) {
    parts.push("=== DIRECTION FROM THE ORCHESTRATOR ===");
    parts.push(direction.trim());
    parts.push("");
  }
  parts.push("=== YOUR TURN ===");
  parts.push(
    "Contribute the next turn. Respond with just your spoken contribution — no preamble, no JSON, no headers.",
  );
  return parts.join("\n");
}
