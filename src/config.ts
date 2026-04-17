import type { Persona } from "./transcript.js";
import { HEAVY_MODEL } from "./models.js";

export type Method = "round-robin" | "popcorn" | "orchestrator";

export interface RoomConfig {
  goal: string;
  method: Method;
  agents: number;
  maxTurns: number;
  threshold: number;
  model: string;
  personas?: Persona[];
  silent: boolean;
}

const ALLOWED_METHODS: Method[] = ["round-robin", "popcorn", "orchestrator"];

function normalizeMethod(raw: unknown): Method {
  if (typeof raw !== "string") return "round-robin";
  const v = raw.toLowerCase().trim();
  if (v === "rr" || v === "roundrobin" || v === "round-robin") return "round-robin";
  if (v === "pop" || v === "popcorn") return "popcorn";
  if (v === "orch" || v === "boss" || v === "orchestrator") return "orchestrator";
  if ((ALLOWED_METHODS as string[]).includes(v)) return v as Method;
  throw new Error(`Unknown method: ${raw}`);
}

export function parseConfig(argv: string[]): RoomConfig {
  const raw = argv[2] ?? process.env.ROOM_CONFIG;
  if (!raw) {
    throw new Error(
      "Missing JSON config. Pass as argv or via ROOM_CONFIG env var. Usage: node room.js '<json>'",
    );
  }
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Could not parse config JSON: ${(e as Error).message}`);
  }
  if (!obj || typeof obj !== "object") {
    throw new Error("Config must be a JSON object.");
  }
  if (typeof obj.goal !== "string" || !obj.goal.trim()) {
    throw new Error("Config.goal is required and must be a non-empty string.");
  }

  let personas: Persona[] | undefined;
  if (Array.isArray(obj.personas)) {
    personas = obj.personas.map((p: any, i: number) => {
      if (!p || typeof p.name !== "string" || typeof p.description !== "string") {
        throw new Error(`personas[${i}] must be {name, description}`);
      }
      return { name: p.name, description: p.description };
    });
  }

  const agents =
    typeof obj.agents === "number" && obj.agents >= 2
      ? Math.floor(obj.agents)
      : personas?.length ?? 3;

  if (personas && personas.length !== agents) {
    // If both given, trust the explicit personas array.
  }

  return {
    goal: obj.goal.trim(),
    method: normalizeMethod(obj.method ?? "round-robin"),
    agents: personas ? personas.length : agents,
    maxTurns:
      typeof obj.maxTurns === "number" && obj.maxTurns > 0
        ? Math.floor(obj.maxTurns)
        : 12,
    threshold:
      typeof obj.threshold === "number" &&
      obj.threshold > 0 &&
      obj.threshold <= 1
        ? obj.threshold
        : 0.85,
    model: typeof obj.model === "string" && obj.model ? obj.model : HEAVY_MODEL,
    personas,
    silent: obj.silent === true,
  };
}
