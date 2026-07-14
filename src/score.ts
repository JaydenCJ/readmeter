/**
 * The scoring engine: runs every enabled check against a parsed document,
 * aggregates per-category and total points, assigns a letter grade and
 * builds the prioritized fix list. Pure — filesystem access happens only
 * through the injected `fileExists` probe.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdown } from "./markdown.js";
import { CATEGORY_ORDER, CHECKS } from "./registry.js";
import type {
  CategoryScore,
  Check,
  CheckContext,
  CheckResult,
  Fix,
  Report,
} from "./types.js";

export interface AnalyzeOptions {
  /** README path used for reporting; null/omitted means "<stdin>". */
  filePath?: string | null;
  /** Directory for relative-link resolution and sibling-file detection. */
  projectDir?: string | null;
  /** Check codes to exclude entirely (validated by the caller). */
  disable?: readonly string[];
  /** Existence probe override; defaults to the real filesystem. */
  fileExists?: (relPath: string) => boolean;
}

/** Letter grade for a 0-100 score. */
export function gradeFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function defaultFileExists(projectDir: string | null): (rel: string) => boolean {
  if (projectDir === null) return () => false;
  return (rel: string) => existsSync(join(projectDir, rel));
}

function runOne(check: Check, ctx: CheckContext): CheckResult {
  const run = check.run(ctx);
  if ("skip" in run) {
    return {
      code: check.code,
      name: check.name,
      category: check.category,
      weight: check.weight,
      status: "skip",
      ratio: 0,
      earned: 0,
      evidence: [],
      fix: null,
      skipReason: run.skip,
    };
  }
  const ratio = Math.min(1, Math.max(0, run.ratio));
  const status = ratio >= 1 ? "pass" : ratio <= 0 ? "fail" : "partial";
  return {
    code: check.code,
    name: check.name,
    category: check.category,
    weight: check.weight,
    status,
    ratio,
    earned: check.weight * ratio,
    evidence: run.evidence,
    fix: status === "pass" ? null : run.fix ?? check.fix,
    skipReason: null,
  };
}

/** Round to one decimal place (points are tenths at finest). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Grade a README source string against the full checklist. */
export function analyze(raw: string, options: AnalyzeOptions = {}): Report {
  const filePath = options.filePath ?? null;
  const projectDir = options.projectDir ?? null;
  const disabled = [...new Set((options.disable ?? []).map((c) => c.toUpperCase()))].sort();
  const enabled = CHECKS.filter((c) => !disabled.includes(c.code));
  if (enabled.length === 0) {
    throw new Error("all checks are disabled; nothing to score");
  }

  const ctx: CheckContext = {
    doc: parseMarkdown(raw),
    filePath,
    projectDir,
    fileExists: options.fileExists ?? defaultFileExists(projectDir),
  };

  const results = enabled.map((check) => runOne(check, ctx));

  let earned = 0;
  let applicable = 0;
  for (const r of results) {
    if (r.status === "skip") continue;
    earned += r.earned;
    applicable += r.weight;
  }
  const score = applicable > 0 ? Math.round((100 * earned) / applicable) : 0;

  const categories: CategoryScore[] = CATEGORY_ORDER.map((category) => {
    const rs = results.filter((r) => r.category === category && r.status !== "skip");
    return {
      category,
      earned: round1(rs.reduce((s, r) => s + r.earned, 0)),
      applicable: rs.reduce((s, r) => s + r.weight, 0),
    };
  });

  const fixes: Fix[] = results
    .filter((r) => r.status === "fail" || r.status === "partial")
    .map((r) => ({
      code: r.code,
      name: r.name,
      points: round1(r.weight - r.earned),
      advice: r.fix ?? "",
    }))
    .sort((a, b) => b.points - a.points || a.code.localeCompare(b.code));

  return {
    file: filePath ?? "<stdin>",
    score,
    grade: gradeFor(score),
    earned: round1(earned),
    applicable,
    results,
    categories,
    fixes,
    disabled,
  };
}
