/**
 * Hand-rolled argument parser: four subcommands (score, checks, explain,
 * badge), a file-shorthand (`readmeter README.md` == `readmeter score
 * README.md`), and strict flag validation. Throws UsageError for anything
 * malformed; the CLI maps that to exit code 2.
 */

export class UsageError extends Error {}

export type Command = "score" | "checks" | "explain" | "badge" | "help" | "version";

export interface ParsedArgs {
  command: Command;
  /** README path for score/badge; "-" means stdin. */
  file: string;
  /** Check code for explain. */
  code: string | null;
  /** Output format for score/checks: text or json. */
  format: "text" | "json";
  /** Output format for badge: markdown or url. */
  badgeFormat: "markdown" | "url";
  /** Fail threshold; null = no gate from the CLI. */
  minScore: number | null;
  /** Check codes given via --disable (not yet validated against the registry). */
  disable: string[];
  configPath: string | null;
  projectDir: string | null;
  /** Badge label override. */
  label: string | null;
}

const COMMANDS = new Set(["score", "checks", "explain", "badge"]);

function defaults(): ParsedArgs {
  return {
    command: "score",
    file: "README.md",
    code: null,
    format: "text",
    badgeFormat: "markdown",
    minScore: null,
    disable: [],
    configPath: null,
    projectDir: null,
    label: null,
  };
}

function takeValue(argv: string[], i: number, flag: string): string {
  const value = argv[i + 1];
  if (value === undefined) {
    throw new UsageError(`${flag} requires a value`);
  }
  return value;
}

/** Parse process argv (without the node/script prefix). */
export function parseArgs(argv: string[]): ParsedArgs {
  const args = defaults();
  const positional: string[] = [];
  let i = 0;

  for (; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--help" || arg === "-h") {
      return { ...args, command: "help" };
    }
    if (arg === "--version" || arg === "-V") {
      return { ...args, command: "version" };
    }
    if (arg === "--format") {
      const v = takeValue(argv, i, "--format");
      i++;
      if (v === "text" || v === "json") args.format = v;
      else if (v === "markdown" || v === "url") args.badgeFormat = v;
      else throw new UsageError(`--format must be text, json, markdown or url (got "${v}")`);
      continue;
    }
    if (arg === "--min-score") {
      const v = takeValue(argv, i, "--min-score");
      i++;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 100) {
        throw new UsageError(`--min-score must be an integer between 0 and 100 (got "${v}")`);
      }
      args.minScore = n;
      continue;
    }
    if (arg === "--disable") {
      const v = takeValue(argv, i, "--disable");
      i++;
      for (const code of v.split(",")) {
        if (code.trim() !== "") args.disable.push(code.trim());
      }
      continue;
    }
    if (arg === "--config") {
      args.configPath = takeValue(argv, i, "--config");
      i++;
      continue;
    }
    if (arg === "--project-dir") {
      args.projectDir = takeValue(argv, i, "--project-dir");
      i++;
      continue;
    }
    if (arg === "--label") {
      args.label = takeValue(argv, i, "--label");
      i++;
      continue;
    }
    if (arg === "-") {
      positional.push(arg);
      continue;
    }
    if (arg.startsWith("-")) {
      throw new UsageError(`unknown option "${arg}"`);
    }
    positional.push(arg);
  }

  const first = positional[0];
  if (first === undefined) {
    args.command = "score";
    return args;
  }

  if (COMMANDS.has(first)) {
    args.command = first as Command;
    const second = positional[1];
    if (positional.length > 2) {
      throw new UsageError(`too many arguments for "${first}"`);
    }
    if (args.command === "explain") {
      if (second === undefined) {
        throw new UsageError("explain requires a check code, e.g. `readmeter explain E103`");
      }
      args.code = second;
    } else if (args.command === "score" || args.command === "badge") {
      if (second !== undefined) args.file = second;
    } else if (second !== undefined) {
      throw new UsageError(`"${first}" takes no arguments`);
    }
    return args;
  }

  // File shorthand: `readmeter path/to/README.md` scores that file.
  if (positional.length > 1) {
    throw new UsageError(`unknown command "${first}"`);
  }
  args.command = "score";
  args.file = first;
  return args;
}

export const HELP_TEXT = `readmeter — grade a README 0-100 against a documented checklist

usage:
  readmeter [score] [file]        grade a README (default: ./README.md; "-" reads stdin)
  readmeter checks                list every check with code, weight and summary
  readmeter explain <code>        full documentation for one check
  readmeter badge [file]          print a shields.io badge for the score

options:
  --format <text|json>            report format for score/checks (default: text)
  --format <markdown|url>         output format for badge (default: markdown)
  --min-score <n>                 exit 1 when the score is below n (CI gate)
  --disable <codes>               comma-separated check codes to skip (repeatable)
  --config <path>                 config file (default: ./.readmeter.json if present)
  --project-dir <dir>             base for relative-link checks (default: the README's directory)
  --label <text>                  badge label (default: "readme score")
  -V, --version                   print the version
  -h, --help                      print this help

exit codes: 0 ok · 1 score below --min-score · 2 usage/config/IO error`;
