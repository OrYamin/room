export interface Persona {
  name: string;
  description: string;
}

export interface Turn {
  persona: string;
  text: string;
}

export function formatTranscriptForPrompt(turns: Turn[]): string {
  if (turns.length === 0) return "(no turns yet — you are opening the discussion)";
  return turns
    .map((t) => `--- ${t.persona} ---\n${t.text.trim()}`)
    .join("\n\n");
}
