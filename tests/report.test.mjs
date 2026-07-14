// Renderers: text report layout, JSON stability, the checks table and
// per-check explanations. Text output is asserted line-by-line where the
// format is load-bearing (CI logs and the README quote it).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  getCheck,
  renderChecksJson,
  renderChecksTable,
  renderExplain,
  renderJson,
  renderText,
  VERSION,
} from "../dist/index.js";
import { analyzeWith, GOOD, GOOD_FILES } from "./helpers.mjs";

test("text report opens with the version, file and score line", () => {
  const text = renderText(analyzeWith(GOOD, GOOD_FILES));
  const lines = text.split("\n");
  assert.equal(lines[0], `readmeter v${VERSION} — README.md`);
  assert.match(lines[2], /^score 100\/100 {2}grade A {2}\(23 passed, 0 partial, 0 failed\)$/);
});

test("text report lists every category with subtotals and every check with a mark", () => {
  const text = renderText(analyzeWith(GOOD, GOOD_FILES));
  for (const label of ["essentials", "structure", "content", "hygiene"]) {
    assert.ok(text.includes(`\n${label}`), label);
  }
  assert.match(text, /\+ E101 {2}project-title/);
  assert.match(text, /top fixes: none/);
});

test("failing report shows partial/fail marks, skip reasons and the fix list", () => {
  const text = renderText(analyzeWith("# t\n\nTODO write me\n", []));
  assert.match(text, /x H401 {2}no-placeholders/);
  assert.match(text, /- S204 {2}quickstart-early {8}skip/);
  assert.match(text, /top fixes \(\+[\d.]+ points available\)/);
  assert.match(text, / 1\. \+10 {3}E10[34]/);
});

test("JSON report is valid, versioned, stable-keyed, and carries per-check evidence", () => {
  const report = analyzeWith(GOOD, GOOD_FILES);
  const parsed = JSON.parse(renderJson(report));
  assert.equal(parsed.readmeter, VERSION);
  assert.equal(parsed.score, 100);
  assert.equal(parsed.grade, "A");
  assert.equal(parsed.checks.length, 23);
  assert.deepEqual(Object.keys(parsed), [
    "readmeter",
    "file",
    "score",
    "grade",
    "earned",
    "applicable",
    "categories",
    "checks",
    "fixes",
    "disabled",
  ]);
  const e101 = parsed.checks.find((c) => c.code === "E101");
  assert.equal(e101.status, "pass");
  assert.equal(e101.fix, null);
  assert.ok(e101.evidence[0].includes("driftwood"));
});

test("checks table lists all 23 checks; JSON variant matches", () => {
  const table = renderChecksTable();
  const rows = table.split("\n").filter((l) => /^[ESCH]\d{3}/.test(l));
  assert.equal(rows.length, 23);
  const json = JSON.parse(renderChecksJson());
  assert.equal(json.length, 23);
  assert.deepEqual(Object.keys(json[0]), ["code", "name", "category", "weight", "summary"]);
});

test("explain output contains code, weight, why and fix", () => {
  const text = renderExplain(getCheck("E105"));
  assert.match(text, /^E105 license-stated \(essentials, 9 points\)/);
  assert.match(text, /why it matters:/);
  assert.match(text, /how to fix:/);
});
