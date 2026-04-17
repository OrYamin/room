---
name: room
description: Start a multi-agent discussion room where several Claude agents with different expert personas collaborate, debate, and plan together. Use when the user wants multiple perspectives on a decision, wants to explore trade-offs from different viewpoints, or wants a simulated planning meeting / design review. Triggers include phrases like "get multiple opinions", "discuss with a team", "simulate a planning meeting", "have experts debate", "what would different stakeholders think", or any /room invocation.
---

# Room skill

You have been invoked as `/room`. A compiled Node.js bundle does all the actual
multi-agent orchestration. Your job is just to translate the user's natural
language arguments into one JSON config line and exec the bundle via Bash.

## Step 1 — parse `$ARGUMENTS`

Build a single-line JSON object with these fields (omit any field the user did
not specify so defaults apply):

- `goal` (string, required) — the discussion topic. Take everything that isn't
  a flag. If the user typed only flags, ask them for the goal first.
- `method` (`"round-robin" | "popcorn" | "orchestrator"`, default `round-robin`).
  Accept synonyms: `rr`→round-robin, `pop`→popcorn, `orch`/`boss`→orchestrator.
- `agents` (integer, default 3) — number of persona agents.
- `maxTurns` (integer, default 12).
- `threshold` (float 0..1, default 0.85) — consensus confidence required to
  stop early.
- `model` (string, optional) — override the heavy model for persona turns.
- `personas` (array of `{name, description}`, optional) — if omitted, the bundle
  auto-generates personas tailored to the goal.

## Step 2 — run the bundle

Execute via the Bash tool, passing the JSON as a single argv arg. Use single
quotes around the JSON and escape any inner single quotes:

```
node ~/.claude/skills/room/room.js '<json-config>'
```

The bundle streams persona turns, router/orchestrator/decision events, and a
final synthesis to stdout. Relay the output back to the user verbatim — do not
paraphrase the discussion.

## Step 3 — working directory

Do NOT `cd` before invoking. The bundle reads `process.cwd()` at startup and
injects it into each persona's prompt so they can ground their points in the
user's current repo via Read/Glob/Grep.

## Notes

- Persona agents have read-only tools only (Read, Glob, Grep, WebSearch,
  WebFetch). They cannot modify files.
- If the bundle errors out, surface the stderr to the user — do not retry
  silently.
