// Scoring engine: registry invariants, aggregation, grade bands,
// renormalization when checks skip, and the prioritized fix list.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { analyze, CHECKS, gradeFor, TOTAL_WEIGHT } from "../dist/index.js";
import { analyzeWith, GOOD, GOOD_FILES } from "./helpers.mjs";

test("registry: weights sum to exactly 100 and codes are unique", () => {
  assert.equal(TOTAL_WEIGHT, 100);
  const codes = CHECKS.map((c) => c.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("registry: every check carries complete documentation metadata", () => {
  for (const c of CHECKS) {
    assert.match(c.code, /^[ESCH][1-4]\d{2}$/, c.code);
    assert.match(c.name, /^[a-z][a-z0-9-]+$/, c.code);
    assert.ok(c.weight >= 1, c.code);
    assert.ok(c.summary.length > 10, c.code);
    assert.ok(c.why.length > 20, c.code);
    assert.ok(c.fix.length > 10, c.code);
  }
});

test("a fully equipped README scores 100 with grade A, no fixes, and consistent subtotals", () => {
  const report = analyzeWith(GOOD, GOOD_FILES);
  assert.equal(report.score, 100);
  assert.equal(report.grade, "A");
  assert.equal(report.applicable, 100);
  assert.deepEqual(report.fixes, []);
  const earned = report.categories.reduce((s, c) => s + c.earned, 0);
  const applicable = report.categories.reduce((s, c) => s + c.applicable, 0);
  assert.equal(Math.round(earned * 10) / 10, report.earned);
  assert.equal(applicable, report.applicable);
});

test("an empty document earns zero essentials and grades F on vacuous hygiene passes alone", () => {
  const report = analyzeWith("", []);
  assert.equal(report.grade, "F");
  assert.ok(report.score <= 25, `score was ${report.score}`);
  const essentials = report.categories.find((c) => c.category === "essentials");
  assert.equal(essentials.earned, 0);
});

test("grade bands sit exactly on their documented boundaries", () => {
  assert.equal(gradeFor(90), "A");
  assert.equal(gradeFor(89), "B");
  assert.equal(gradeFor(80), "B");
  assert.equal(gradeFor(79), "C");
  assert.equal(gradeFor(70), "C");
  assert.equal(gradeFor(69), "D");
  assert.equal(gradeFor(60), "D");
  assert.equal(gradeFor(59), "F");
});

test("skipped checks renormalize: the same content scores equally with and without code-dependent checks", () => {
  // No code blocks -> C301/C303 skip; the denominator shrinks accordingly.
  const report = analyzeWith("# t\n\nprose only\n", []);
  const skipped = report.results.filter((r) => r.status === "skip").map((r) => r.code);
  assert.ok(skipped.includes("C301"));
  assert.ok(skipped.includes("C303"));
  assert.equal(report.applicable, 100 - 4 - 3 - 3); // C301 + C303 + S204 skip
  assert.equal(report.score, Math.round((100 * report.earned) / report.applicable));
});

test("disabled checks are excluded and echoed; disabling everything is an error", () => {
  const report = analyzeWith(GOOD, GOOD_FILES, { disable: ["c306", "C302"] });
  assert.deepEqual(report.disabled, ["C302", "C306"]);
  assert.ok(!report.results.some((r) => r.code === "C306" || r.code === "C302"));
  assert.equal(report.applicable, 94);
  assert.equal(report.score, 100);
  assert.throws(
    () => analyze("# t\n", { disable: CHECKS.map((c) => c.code) }),
    /all checks are disabled/
  );
});

test("fixes are ordered by recoverable points, ties broken by code", () => {
  const report = analyzeWith("# t\n\nshort\n", []);
  const points = report.fixes.map((f) => f.points);
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i - 1] >= points[i], "descending points");
  }
  for (let i = 1; i < report.fixes.length; i++) {
    if (report.fixes[i - 1].points === report.fixes[i].points) {
      assert.ok(report.fixes[i - 1].code < report.fixes[i].code, "code tiebreak");
    }
  }
  for (const f of report.fixes) {
    assert.ok(f.advice.length > 0, `${f.code} has advice`);
  }
});

test("analyze is deterministic: identical input yields identical reports", () => {
  const a = analyzeWith(GOOD, GOOD_FILES);
  const b = analyzeWith(GOOD, GOOD_FILES);
  assert.deepEqual(a, b);
});
