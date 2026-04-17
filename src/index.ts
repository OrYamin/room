import { parseConfig } from "./config.js";
import { runQuery } from "./sdk/query.js";
import { HEAVY_MODEL, META_TOOLS } from "./models.js";
import {
  buildPersonaGenerationPrompt,
  buildSynthesisPrompt,
} from "./prompts/synthesis.js";
import { runRoundRobin } from "./methods/roundRobin.js";
import { runPopcorn } from "./methods/popcorn.js";
import { runOrchestrator } from "./methods/orchestrator.js";
import { extractJsonArray, META_MAX_TURNS } from "./methods/_shared.js";
import type { Persona } from "./transcript.js";
import { printError, printHeader, printMeta, ui } from "./ui.js";

async function generatePersonas(
  goal: string,
  count: number,
  cwd: string,
): Promise<Persona[]> {
  const raw = await runQuery({
    prompt: buildPersonaGenerationPrompt(goal, count, cwd),
    cwd,
    model: HEAVY_MODEL,
    allowedTools: META_TOOLS,
    maxTurns: META_MAX_TURNS,
    label: "persona-gen",
    silent: true,
  });
  const arr = extractJsonArray(raw);
  if (!arr) {
    throw new Error(`Could not parse persona generation output: ${raw.slice(0, 200)}`);
  }
  const personas: Persona[] = [];
  for (const p of arr) {
    if (p && typeof p.name === "string" && typeof p.description === "string") {
      personas.push({ name: p.name, description: p.description });
    }
  }
  if (personas.length < 2) {
    throw new Error(
      `Persona generation returned fewer than 2 valid personas: ${raw.slice(0, 200)}`,
    );
  }
  return personas.slice(0, count);
}

async function main(): Promise<void> {
  const cfg = parseConfig(process.argv);
  const cwd = process.cwd();

  printHeader(`Room — ${cfg.method}`);
  printMeta(`  goal: ${cfg.goal}`);
  printMeta(`  cwd: ${cwd}`);
  printMeta(
    `  agents=${cfg.agents} maxTurns=${cfg.maxTurns} threshold=${cfg.threshold} model=${cfg.model}`,
  );

  let personas: Persona[];
  if (cfg.personas && cfg.personas.length > 0) {
    personas = cfg.personas;
    printMeta(`  personas: ${personas.map((p) => p.name).join(", ")} (user-supplied)`);
  } else {
    printMeta(`  generating ${cfg.agents} personas...`);
    personas = await generatePersonas(cfg.goal, cfg.agents, cwd);
    printMeta(`  personas: ${personas.map((p) => p.name).join(", ")}`);
  }

  let transcript: Awaited<ReturnType<typeof runRoundRobin>>["transcript"];
  let reachedConsensus: boolean;
  let orchestratorSummary: string | undefined;

  if (cfg.method === "round-robin") {
    ({ transcript, reachedConsensus } = await runRoundRobin(cfg, personas, cwd));
  } else if (cfg.method === "popcorn") {
    ({ transcript, reachedConsensus } = await runPopcorn(cfg, personas, cwd));
  } else {
    ({ transcript, reachedConsensus, orchestratorSummary } = await runOrchestrator(
      cfg,
      personas,
      cwd,
    ));
  }

  printHeader("Synthesis");
  if (orchestratorSummary) {
    printMeta(`  ${ui.dim("(orchestrator already issued a consensus summary above)")}`);
  }
  await runQuery({
    prompt: buildSynthesisPrompt(cfg.goal, transcript, reachedConsensus),
    cwd,
    model: HEAVY_MODEL,
    allowedTools: META_TOOLS,
    maxTurns: META_MAX_TURNS,
    label: "synthesis",
    silent: false,
  });

  printHeader(
    reachedConsensus ? "Done — consensus reached" : "Done — max turns hit",
  );
}

main().catch((err) => {
  printError(`room: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) {
    process.stderr.write(err.stack + "\n");
  }
  process.exit(1);
});
