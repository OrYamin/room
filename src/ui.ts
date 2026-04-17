const isTTY = !!process.stdout.isTTY;

function color(code: string, text: string): string {
  if (!isTTY) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

export const ui = {
  bold: (s: string) => color("1", s),
  dim: (s: string) => color("2", s),
  cyan: (s: string) => color("36", s),
  yellow: (s: string) => color("33", s),
  magenta: (s: string) => color("35", s),
  green: (s: string) => color("32", s),
  red: (s: string) => color("31", s),
};

export function printHeader(title: string): void {
  const bar = "=".repeat(Math.max(8, 60 - title.length));
  process.stdout.write(`\n${ui.bold(ui.cyan(`== ${title} ${bar}`))}\n`);
}

export function printPersonaHeader(name: string, turnIndex: number): void {
  process.stdout.write(
    `\n${ui.bold(ui.magenta(`[turn ${turnIndex + 1}] ${name}`))}\n`,
  );
}

export function printMeta(line: string): void {
  process.stdout.write(`${ui.dim(line)}\n`);
}

export function printError(line: string): void {
  process.stderr.write(`${ui.red(line)}\n`);
}
