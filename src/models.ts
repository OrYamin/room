export const HEAVY_MODEL = "claude-opus-4-6";
export const LIGHT_MODEL = "claude-haiku-4-5";
export const ORCHESTRATOR_MODEL = HEAVY_MODEL;

export const PERSONA_TOOLS: string[] = [
  "Read",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
];

export const META_TOOLS: string[] = [];

export const DEFENSIVE_DISALLOWED: string[] = [
  "Edit",
  "Write",
  "NotebookEdit",
  "Bash",
  "Task",
  "Agent",
];
