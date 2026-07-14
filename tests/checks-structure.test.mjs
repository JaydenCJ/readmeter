// Structure checks (S2xx): hierarchy, TOC thresholds, length bands,
// quickstart position and empty-section detection — including the
// skip conditions that keep them honest on degenerate inputs.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assertRatio, runCheck } from "./helpers.mjs";

test("S201: clean hierarchy passes; level jumps and headingless documents fail", () => {
  assertRatio("S201", "# t\n\n## a\n\n### b\n\n## c\n", 1);
  const jump = assertRatio("S201", "# t\n\n## a\n\n#### deep\n", 0.3);
  assert.match(jump.evidence[0], /h2 -> h4 jump at line 5/);
  assertRatio("S201", "just prose\nand more prose\n", 0);
});

test("S202: short READMEs pass without a TOC", () => {
  const run = assertRatio("S202", "# t\n\nshort\n", 1);
  assert.match(run.evidence[0], /not required/);
});

test("S202: 120+ lines require a TOC heading or anchor links", () => {
  const filler = Array.from({ length: 130 }, (_, i) => `filler line ${i}`).join("\n");
  assertRatio("S202", `# t\n\n${filler}\n`, 0);
  assertRatio("S202", `# t\n\n## Table of contents\n\n${filler}\n`, 1);
  const anchors = "- [a](#a)\n- [b](#b)\n- [c](#c)\n";
  assertRatio("S202", `# t\n\n${anchors}\n${filler}\n`, 1);
});

test("S203: word-count bands — thin 0, sparse 0.5, healthy 1, manual 0.7", () => {
  assertRatio("S203", "# t\n\nfive words of prose here\n", 0);
  const sparse = Array.from({ length: 50 }, () => "word word").join("\n");
  assertRatio("S203", `# t\n\n${sparse}\n`, 0.5);
  const healthy = Array.from({ length: 100 }, () => "some words in a line").join(" ");
  assertRatio("S203", `# t\n\n${healthy}\n`, 1);
  const manual = Array.from({ length: 500 }, () => "nine words here in this very long line now").join("\n");
  assertRatio("S203", `# t\n\n${manual}\n`, 0.7);
});

test("S204: early install passes, a buried one earns 0.4, no hands-on section skips", () => {
  assertRatio("S204", "# t\n\n## Install\n\n```bash\nnpm i t\n```\n", 1);
  const filler = Array.from({ length: 200 }, (_, i) => `background ${i}`).join("\n");
  assertRatio("S204", `# t\n\n${filler}\n\n## Install\n\ntext\n`, 0.4);
  const skip = runCheck("S204", "# t\n\n## About\n\ntext\n");
  assert.ok("skip" in skip);
  assert.match(skip.skip, /E103\/E104/);
});

test("S205: a heading with subsections is a parent, not an empty section", () => {
  assertRatio("S205", "# t\n\n## Guide\n\n### Part one\n\ntext\n", 1);
});

test("S205: one empty section 0.5, two 0; no sections at all skips", () => {
  const one = assertRatio("S205", "# t\n\nintro\n\n## Empty\n", 0.5);
  assert.match(one.evidence[0], /"Empty" \(line 5\)/);
  assertRatio("S205", "# t\n\nintro\n\n## A\n\n## B\n", 0);
  assert.ok("skip" in runCheck("S205", "prose only\n"));
});
