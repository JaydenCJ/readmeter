/**
 * CLI entry point. Wires argument parsing, config loading, the scoring
 * engine and the renderers together, and maps every failure mode to a
 * documented exit code: 0 ok, 1 score below --min-score, 2 usage/config/IO.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { badgeMarkdown, badgeUrl } from "./badge.js";
import { HELP_TEXT, parseArgs, UsageError, type ParsedArgs } from "./cliargs.js";
import { ConfigError, loadConfig, validateCodes } from "./config.js";
import { getCheck } from "./registry.js";
import {
  renderChecksJson,
  renderChecksTable,
  renderExplain,
  renderJson,
  renderText,
} from "./report.js";
import { analyze } from "./score.js";
import { VERSION } from "./version.js";
import type { Report } from "./types.js";

function readInput(file: string): { raw: string; filePath: string | null } {
  if (file === "-") {
    return { raw: readFileSync(0, "utf8"), filePath: null };
  }
  const abs = resolve(file);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new ConfigError(`cannot read "${file}": no such file`);
  }
  return { raw: readFileSync(abs, "utf8"), filePath: file };
}

function resolveProjectDir(args: ParsedArgs, filePath: string | null): string | null {
  if (args.projectDir !== null) {
    const abs = resolve(args.projectDir);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) {
      throw new ConfigError(`--project-dir "${args.projectDir}" is not a directory`);
    }
    return abs;
  }
  return filePath !== null ? dirname(resolve(filePath)) : null;
}

function buildReport(args: ParsedArgs): { report: Report; minScore: number | null } {
  const { config } = loadConfig(args.configPath, process.cwd());
  const disable = [...config.disable, ...validateCodes(args.disable, "--disable")];
  const minScore = args.minScore ?? config.minScore;
  const { raw, filePath } = readInput(args.file);
  const projectDir = resolveProjectDir(args, filePath);
  const report = analyze(raw, { filePath, projectDir, disable });
  return { report, minScore };
}

function commandScore(args: ParsedArgs): number {
  const { report, minScore } = buildReport(args);
  console.log(args.format === "json" ? renderJson(report) : renderText(report));
  if (minScore !== null && report.score < minScore) {
    console.error(`readmeter: score ${report.score} is below the minimum ${minScore}`);
    return 1;
  }
  return 0;
}

function commandBadge(args: ParsedArgs): number {
  const { report } = buildReport(args);
  const label = args.label ?? "readme score";
  console.log(
    args.badgeFormat === "url" ? badgeUrl(report.score, label) : badgeMarkdown(report.score, label)
  );
  return 0;
}

function commandExplain(args: ParsedArgs): number {
  const code = args.code ?? "";
  const check = getCheck(code);
  if (check === undefined) {
    console.error(
      `readmeter: unknown check code "${code}" (run \`readmeter checks\` for the list)`
    );
    return 2;
  }
  console.log(renderExplain(check));
  return 0;
}

/** Run the CLI against an argv slice; returns the process exit code. */
export function main(argv: string[]): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`readmeter: ${err.message}`);
      console.error(`run \`readmeter --help\` for usage`);
      return 2;
    }
    throw err;
  }

  try {
    switch (args.command) {
      case "help":
        console.log(HELP_TEXT);
        return 0;
      case "version":
        console.log(VERSION);
        return 0;
      case "checks":
        console.log(args.format === "json" ? renderChecksJson() : renderChecksTable());
        return 0;
      case "explain":
        return commandExplain(args);
      case "badge":
        return commandBadge(args);
      case "score":
        return commandScore(args);
    }
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`readmeter: ${err.message}`);
      return 2;
    }
    throw err;
  }
}

process.exitCode = main(process.argv.slice(2));
