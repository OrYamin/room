export const META_MAX_TURNS = 4;
export const PERSONA_MAX_TURNS = 30;

export function extractJsonObject(raw: string): any | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  return null;
}

export function extractJsonArray(raw: string): any[] | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  const match = trimmed.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

export interface DecisionResult {
  confidence: number;
  reason: string;
}

export function parseDecision(raw: string): DecisionResult {
  const obj = extractJsonObject(raw);
  if (!obj) return { confidence: 0, reason: "unparseable decision response" };
  const c = typeof obj.confidence === "number" ? obj.confidence : 0;
  const clamped = Math.max(0, Math.min(1, c));
  const reason =
    typeof obj.reason === "string" ? obj.reason : "(no reason given)";
  return { confidence: clamped, reason };
}
