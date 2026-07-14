/**
 * Renderers for the score report (text and JSON), the checklist table and
 * per-check explanations. Text output is deterministic and column-aligned;
 * JSON output has a stable key order for CI consumption.
 */

import { CATEGORY_LABELS, CATEGORY_ORDER, CHECKS } from "./registry.js";
import { VERSION } from "./version.js";
import type { Check, CheckResult, Report } from "./types.js";

const STATUS_MARK: Record<CheckResult["status"], string> = {
  pass: "+",
  partial: "~",
  fail: "x",
  skip: "-",
};

/** Format points: integers stay bare, fractions get one decimal. */
export function fmtPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function statusCounts(report: Report): string {
  const count = (s: CheckResult["status"]): number =>
    report.results.filter((r) => r.status === s).length;
  const parts = [
    `${count("pass")} passed`,
    `${count("partial")} partial`,
    `${count("fail")} failed`,
  ];
  const skipped = count("skip");
  if (skipped > 0) parts.push(`${skipped} skipped`);
  if (report.disabled.length > 0) parts.push(`${report.disabled.length} disabled`);
  return parts.join(", ");
}

/** Render the full human-readable report. */
export function renderText(report: Report): string {
  const out: string[] = [];
  out.push(`readmeter v${VERSION} — ${report.file}`);
  out.push("");
  out.push(`score ${report.score}/100  grade ${report.grade}  (${statusCounts(report)})`);
  out.push("");

  for (const category of CATEGORY_ORDER) {
    const cat = report.categories.find((c) => c.category === category);
    const results = report.results.filter((r) => r.category === category);
    if (cat === undefined || results.length === 0) continue;
    out.push(
      `${CATEGORY_LABELS[category].toLowerCase().padEnd(38)}${fmtPoints(cat.earned)}/${cat.applicable}`
    );
    for (const r of results) {
      const pts =
        r.status === "skip" ? "skip" : `${fmtPoints(Math.round(r.earned * 10) / 10)}/${r.weight}`;
      const head = `  ${STATUS_MARK[r.status]} ${r.code}  ${r.name.padEnd(24)}${pts.padEnd(8)}`;
      const detail = r.status === "skip" ? r.skipReason ?? "" : r.evidence[0] ?? "";
      out.push(`${head}${detail}`);
      for (const extra of r.evidence.slice(1)) {
        out.push(`${" ".repeat(42)}${extra}`);
      }
    }
    out.push("");
  }

  if (report.fixes.length === 0) {
    out.push("top fixes: none — every applicable check passed");
  } else {
    const total = Math.round(report.fixes.reduce((s, f) => s + f.points, 0) * 10) / 10;
    out.push(`top fixes (+${fmtPoints(total)} ${total === 1 ? "point" : "points"} available)`);
    report.fixes.forEach((f, i) => {
      out.push(
        `  ${String(i + 1).padStart(2)}. +${fmtPoints(f.points).padEnd(5)}${f.code} ${f.name} — ${f.advice}`
      );
    });
  }
  return out.join("\n");
}

/** Render the machine-readable report with a stable key order. */
export function renderJson(report: Report): string {
  const obj = {
    readmeter: VERSION,
    file: report.file,
    score: report.score,
    grade: report.grade,
    earned: report.earned,
    applicable: report.applicable,
    categories: report.categories.map((c) => ({
      category: c.category,
      earned: c.earned,
      applicable: c.applicable,
    })),
    checks: report.results.map((r) => ({
      code: r.code,
      name: r.name,
      category: r.category,
      weight: r.weight,
      status: r.status,
      earned: Math.round(r.earned * 10) / 10,
      evidence: r.evidence,
      fix: r.fix,
      skipReason: r.skipReason,
    })),
    fixes: report.fixes,
    disabled: report.disabled,
  };
  return JSON.stringify(obj, null, 2);
}

/** Render the checklist reference table (for `readmeter checks`). */
export function renderChecksTable(): string {
  const out: string[] = [];
  out.push(`readmeter v${VERSION} — ${CHECKS.length} checks, 100 points`);
  out.push("");
  out.push(`code  name                      category    pts  summary`);
  for (const c of CHECKS) {
    out.push(
      `${c.code}  ${c.name.padEnd(24)}  ${c.category.padEnd(10)}  ${String(c.weight).padStart(3)}  ${c.summary}`
    );
  }
  return out.join("\n");
}

/** Render the checklist as JSON. */
export function renderChecksJson(): string {
  return JSON.stringify(
    CHECKS.map((c) => ({
      code: c.code,
      name: c.name,
      category: c.category,
      weight: c.weight,
      summary: c.summary,
    })),
    null,
    2
  );
}

/** Render a single check's full documentation (for `readmeter explain`). */
export function renderExplain(check: Check): string {
  return [
    `${check.code} ${check.name} (${check.category}, ${check.weight} points)`,
    "",
    check.summary,
    "",
    "why it matters:",
    `  ${check.why}`,
    "",
    "how to fix:",
    `  ${check.fix}`,
  ].join("\n");
}
