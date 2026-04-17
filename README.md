# Room

**A Claude Code skill that runs a multi-agent discussion room.**

Room is installed as a `/room` slash-command skill for
[Claude Code](https://claude.com/claude-code). When you invoke it, Claude
Code spawns several agents with distinct expert personas, they discuss your
goal until consensus is reached (or a turn cap is hit), and you get back a
written synthesis — all inside the same Claude Code session.

```
/room should we adopt Bun instead of Node for our tooling?
```

Personas are grounded in whatever repo your Claude Code session is open in:
each agent gets `Read`, `Glob`, `Grep`, `WebSearch`, and `WebFetch` so they
can cite real files instead of vibing at each other.

---

## Table of contents

- [Why Room](#why-room)
- [Installation](#installation)
- [Getting started](#getting-started)
- [Discussion modes](#discussion-modes)
- [Configuration](#configuration)
- [A real example](#a-real-example)
- [Architecture](#architecture)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Why Room

Solo Claude is great at *executing*. Solo Claude is less great at *weighing*
— tradeoffs tend to get papered over with "it depends" bullet lists. Room puts
adversarial personas in the same conversation so genuine disagreement surfaces
before a decision gets made.

Use Room when you want:

- Multiple perspectives on an architecture / stack / process decision
- A simulated design review before writing a PR
- Pushback from a "reliability lead" / "security reviewer" / "skeptical PM"
  on an idea you already half-like
- A planning meeting you didn't have to schedule

---

## Installation

Room is a Claude Code skill. Install it once, then it's available as `/room`
in every Claude Code session on your machine.

**Prerequisites**

- [Claude Code](https://claude.com/claude-code) installed and authenticated
  (`claude login`)
- Node.js 20+
- `bash` on `PATH` (Git Bash on Windows works)

**Install**

```bash
git clone <your-fork-or-this-repo> room
cd room
bash install.sh
```

`install.sh` installs deps, bundles `src/` via esbuild, and deploys the
bundle plus `SKILL.md` to `~/.claude/skills/room/`. Open (or restart) a
Claude Code session and `/room` will be available as a slash command.

---

## Getting started

Room is a slash command. Invoke it inside Claude Code by typing `/room`
followed by your question in plain English:

```
/room should we add a pre-commit hook that runs typecheck?
```

Claude Code parses your wording, translates it into a config for the Room
skill, and streams the discussion back into the conversation: persona
generation, each turn, and a final synthesis.

### Picking a mode

Describe the [discussion mode](#discussion-modes) you want in the same line:

```
/room have the team debate (orchestrator style) whether we should migrate the monolith
/room do a popcorn-mode discussion on our caching strategy
/room round-robin: should we switch from Jest to Vitest?
```

### Tweaking the discussion

Describe the shape you want — Claude Code fills in the right config fields:

```
/room with 4 agents and up to 15 turns, debate whether to introduce feature flags
/room keep it short (2 agents, 4 turns): is REST or gRPC better for this service?
/room include a security reviewer, a perf engineer, and a frontend lead: should we SSR this page?
```

### Working directory matters

Room captures the Claude Code session's working directory and injects it into
every persona's prompt. Personas will open and read files in *that* repo. If
you want Room to discuss a specific codebase, open Claude Code in that repo.

---

## Discussion modes

Three methods, each tuned for a different kind of conversation. All three stop
on consensus (confidence ≥ `threshold`) or when `maxTurns` is reached, then
end with a written synthesis.

### `round-robin` (default)

Personas speak in a fixed rotation: `[A, B, C, A, B, C, ...]`. After every full
cycle, a lightweight decision-check asks "has the group actually resolved
this?" and stops the discussion if yes.

**Use when**: you want every persona to weigh in equally, you don't care about
conversational flow, or you're debugging personas and want predictable order.

```
/room round-robin: should we write unit tests for pure utilities or rely on integration tests?
```

### `popcorn`

Emergent order. Each cycle, every persona must speak once before anyone
repeats, but *who goes next* is decided each turn by a lightweight router
agent that reads the transcript and picks whoever would most naturally
respond.

**Use when**: you want the discussion to feel more organic — the security
reviewer should jump in right after the architect mentions auth, not three
turns later because of rotation order.

```
/room popcorn: should we expose this service publicly or keep it internal?
```

### `orchestrator`

A dedicated orchestrator agent (a real SDK call, not code logic) runs before
every turn: it reads the transcript, decides whether consensus has been
reached, and if not, picks the next speaker *and gives them a direction*
("push back on X", "make the strongest case for Y"). The orchestrator itself
signals when the discussion is over.

**Use when**: the goal is contested and you want active facilitation — the
orchestrator will direct personas to challenge each other rather than let
polite agreement coast to a fake consensus. Best for hard architectural calls
where you want adversarial engagement.

```
/room orchestrate a debate on migrating the monolith to microservices over the next 6 months
```

### Quick comparison

| Mode           | Turn order                   | Consensus check          | Best for                                    |
| -------------- | ---------------------------- | ------------------------ | ------------------------------------------- |
| `round-robin`  | Fixed rotation               | End of each cycle        | Fair airtime, predictable, debugging        |
| `popcorn`      | LLM-picked from unused set   | End of each cycle        | Natural flow, reactive conversation         |
| `orchestrator` | LLM-picked every turn + direction | Every turn, by orchestrator | Contested decisions, active facilitation |

---

## Configuration

Describe what you want to Claude Code and it fills these in. Useful to know
what's tunable:

| Field        | Type                                         | Default             | Description                                                   |
| ------------ | -------------------------------------------- | ------------------- | ------------------------------------------------------------- |
| `goal`       | string *(required)*                          | —                   | The discussion topic.                                         |
| `method`     | `"round-robin" \| "popcorn" \| "orchestrator"` | `"round-robin"`     | Discussion method.                                            |
| `agents`     | integer                                      | `3`                 | Number of personas (ignored if `personas` is supplied).       |
| `maxTurns`   | integer                                      | `12`                | Hard cap on persona turns.                                    |
| `threshold`  | number `0..1`                                | `0.85`              | Consensus confidence required to stop early.                  |
| `model`      | string                                       | `claude-opus-4-6`   | Override the heavy model used for persona turns & synthesis.  |
| `personas`   | `{name, description}[]`                      | auto-generated      | Supply personas yourself instead of generating from the goal. |
| `silent`     | boolean                                      | `false`             | Suppress streaming of persona turns (synthesis still prints). |

### Models

Configured in [`src/models.ts`](src/models.ts):

- **Heavy** (`claude-opus-4-6`) — persona turns, orchestrator, synthesis.
  These need real reasoning.
- **Light** (`claude-haiku-4-5`) — popcorn router, decision-check. These are
  small classification-ish calls.

Change one place to upgrade everywhere.

### Tool policy

- **Personas**: `Read`, `Glob`, `Grep`, `WebSearch`, `WebFetch`. Read-only —
  they cannot modify the repo.
- **Meta calls** (router, decision-check, orchestrator, persona generator,
  synthesis): no tools. They produce JSON / text and return.

Enforced via the SDK's `tools` option (gates the whole registry — not just
`allowedTools`, which only controls auto-approval).

---

## A real example

From a TypeScript repo, inside a Claude Code session:

```
/room orchestrate a debate with 3 agents: should we add a pre-commit hook that runs tsc --noEmit?
```

Abbreviated run (streams into the Claude Code conversation):

```
== Room — orchestrator =========================================
  goal: Should we add a pre-commit hook that runs tsc --noEmit?
  cwd: /home/me/src/my-typescript-app
  agents=3 maxTurns=10 threshold=0.85 model=claude-opus-4-6
  generating 3 personas...
  personas: DevEx Engineer, Reliability Lead, Tooling & CI Architect

  orchestrator: next=Reliability Lead — Open the discussion by making the strongest
  case for catching type errors at commit time rather than in CI.

[turn 1] Reliability Lead
I looked at .github/workflows/ci.yml — tsc runs on every PR, but the
feedback loop is ~4 minutes. For a team our size that's enough friction
that people merge past a failing typecheck and fix forward. A local
pre-commit hook closes that gap. Concretely: a 6s tsc --noEmit --incremental
on a warm cache is cheaper than one reverted merge.

  orchestrator: next=DevEx Engineer — Push back on the velocity cost.

[turn 2] DevEx Engineer
Two concerns. One: tsc --noEmit on this repo cold is 42s (I just ran it).
That's real commit latency for people rebasing interactively. Two: the
hook lives in husky/, which means contributors on fresh checkouts hit it
before running npm install — we've had three Slack threads about that in
the last quarter. I'd rather invest in speeding up CI feedback (merge queue,
parallel type/test).

[turn 3] Tooling & CI Architect
Both points are real, but the fix is obvious: use tsc's --incremental mode
with .tsbuildinfo committed to a scratch dir (see tsconfig.json:compilerOptions).
Warm runs are 3-6s on this codebase. We gate the hook on staged *.ts files
only, so docs-only commits skip it entirely. The husky-before-install issue
is fixed by `npm install --ignore-scripts` in CI — we already do that.

... (continues) ...

  decision-check: confidence=0.91 reason=clear consensus on incremental tsc,
  staged-file scoping, and the husky bootstrap workaround

== Synthesis ===================================================
### Outcome
Adopt a pre-commit hook that runs `tsc --noEmit --incremental` scoped to
staged `*.ts` files, with `.tsbuildinfo` kept in a git-ignored scratch dir.

### Key points
- Warm incremental runs are 3-6s on this repo; cold is 42s — acceptable for
  commits, not for every CI run.
- Scope to staged TS files so docs/config commits aren't penalized.
- `--ignore-scripts` pattern already in CI handles the husky bootstrap gap.
- CI typecheck stays — hook is a fast-feedback layer, not a replacement.

### Recommended next step
Add `.husky/pre-commit` running `pnpm exec tsc --noEmit --incremental` gated
on staged `.ts`/`.tsx` files; measure commit latency for a week before
expanding scope.
```

Each turn is grounded in the actual repo (the Reliability Lead really ran
`tsc --noEmit`; the Architect really read `tsconfig.json`), and the
orchestrator actively pushed back rather than letting the first agent win by
default.

---

## Architecture

```
room/
├── src/
│   ├── index.ts              # entry: parse config, dispatch to method
│   ├── config.ts             # config parsing + defaults
│   ├── models.ts             # HEAVY / LIGHT / tool policy constants
│   ├── transcript.ts         # Turn type + formatting
│   ├── ui.ts                 # console rendering
│   ├── sdk/
│   │   ├── query.ts          # the single runQuery() wrapper — all SDK calls go through here
│   │   ├── options.ts        # buildBaseOptions()
│   │   ├── stream.ts         # text extraction from SDK messages
│   │   └── errors.ts         # error classification, FirstEventTimeoutError
│   ├── prompts/              # pure prompt builders (no SDK imports, no side effects)
│   │   ├── persona.ts
│   │   ├── orchestrator.ts
│   │   ├── popcornRouter.ts
│   │   ├── decision.ts
│   │   └── synthesis.ts
│   └── methods/
│       ├── roundRobin.ts
│       ├── popcorn.ts
│       ├── orchestrator.ts
│       └── _shared.ts        # JSON extraction helpers, turn-count constants
├── skill/SKILL.md            # what Claude Code loads from ~/.claude/skills/room/
└── install.sh
```

### How the skill hooks into Claude Code

- `skill/SKILL.md` is installed to `~/.claude/skills/room/SKILL.md` and tells
  Claude Code when to trigger `/room` and how to invoke the bundle.
- Claude Code parses your natural-language `/room …` invocation, builds a JSON
  config (goal, method, agents, maxTurns, …), and runs the bundle via Bash.
- The bundle streams its output back into the Claude Code conversation.

### Design principles

- **One SDK wrapper**: every `query()` call goes through `runQuery()` in
  `src/sdk/query.ts`. It handles retry with exponential backoff, first-event
  timeout (via `Promise.race` + `AbortController`), error classification,
  stdout streaming, and text extraction. No logic file touches the SDK
  directly.
- **Pure prompt builders**: `src/prompts/*.ts` are pure functions taking plain
  data and returning strings. Zero SDK imports. This makes them testable in
  isolation and trivially reusable.
- **cwd as first-class input**: captured once at startup, threaded to every
  `runQuery` call and every persona system prompt.
- **Heavy vs light models by intent**: routing and decision-check are
  classification-ish — Haiku. Turns and synthesis need reasoning — Opus.

---

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # esbuild bundle → dist/room.js
bash install.sh     # rebuild + deploy to ~/.claude/skills/room/
```

`.vscode/launch.json` ships three F5 configs for stepping through the bundle
with sourcemaps while you're developing.

---

## Contributing

Issues and PRs welcome. A few notes if you're adding to Room:

- **Route new SDK calls through `runQuery`** so retry, timeout, and error
  handling stay uniform.
- **Keep prompt files pure** — `src/prompts/*.ts` take plain data and return
  strings, with no SDK imports.
- **Meta calls pass `tools: []`** (router, orchestrator, decision-check,
  persona generator, synthesis).
- **Persona calls use `PERSONA_TOOLS`** from `src/models.ts` — the read-only
  set. Personas are advisors, not actors.
- **New discussion method?** Implement it in `src/methods/<name>.ts`, wire it
  into `src/index.ts`'s method switch, and update `config.ts`'s
  `normalizeMethod` + the `method` type.
- **Update `skill/SKILL.md`** when you add a config field or change how the
  bundle is invoked — that's how Claude Code knows to wire natural-language
  requests to it.

Run `npm run typecheck` before pushing.

---

## License

MIT. See [LICENSE](LICENSE).
