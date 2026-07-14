// Content checks (C3xx): fence tags, badges, captured output,
// prerequisites, contributing, visuals, features and outbound docs links.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assertRatio, runCheck } from "./helpers.mjs";

test("C301: ratio is proportional to tagged fences; no fences at all skips", () => {
  assertRatio("C301", "# t\n\n```bash\na\n```\n\n```text\nb\n```\n", 1);
  const half = assertRatio("C301", "# t\n\n```bash\na\n```\n\n```\nb\n```\n", 0.5);
  assert.match(half.evidence[0], /untagged fence at line 7/);
  assert.ok("skip" in runCheck("C301", "# t\n\nprose only\n"));
});

test("C302: tiers — near-top 1, none 0, buried 0.5, a wall of 11+ 0.7", () => {
  assertRatio("C302", "# t\n\n![b](https://img.shields.io/badge/l-m-c)\n", 1);
  assertRatio("C302", "# t\n\nno badges anywhere\n", 0);
  const buried = `# t\n\n## A\n\n${"filler\n".repeat(20)}\n![b](https://img.shields.io/badge/l-m-c)\n`;
  assertRatio("C302", buried, 0.5);
  const wall = Array.from({ length: 11 }, (_, i) => `![b${i}](https://img.shields.io/badge/b-${i}-c)`).join(" ");
  assertRatio("C302", `# t\n\n${wall}\n`, 0.7);
});

test("C303: a ```text block or an output-labelled block passes; naked commands fail; no code skips", () => {
  assertRatio("C303", "# t\n\n```bash\nt run\n```\n\n```text\ndone\n```\n", 1);
  assertRatio("C303", "# t\n\nRunning it prints:\n\n```bash\nresult line\n```\n", 1);
  assertRatio("C303", "# t\n\n```bash\nt run\n```\n", 0);
  assert.ok("skip" in runCheck("C303", "# t\n\nprose\n"));
});

test("C304: a Requirements heading or an inline version statement passes", () => {
  assertRatio("C304", "# t\n\n## Requirements\n\nstuff\n", 1);
  assertRatio("C304", "# t\n\nRequires Node.js >= 20 to run.\n", 1);
  assertRatio("C304", "# t\n\nWorks with Python 3.11 and later.\n", 1);
  assertRatio("C304", "# t\n\nnothing about versions\n", 0);
});

test("C305: a Contributing section or link passes; an unreferenced file earns 0.5", () => {
  assertRatio("C305", "# t\n\n## Contributing\n\nPRs welcome.\n", 1);
  assertRatio("C305", "# t\n\nSee [the guide](CONTRIBUTING.md).\n", 1, ["CONTRIBUTING.md"]);
  assertRatio("C305", "# t\n\nnothing\n", 0.5, ["CONTRIBUTING.md"]);
  assertRatio("C305", "# t\n\nnothing\n", 0, []);
});

test("C306: a content image passes, a badge alone does not, an <img> tag counts", () => {
  assertRatio("C306", "# t\n\n![shot](docs/shot.png)\n", 1);
  assertRatio("C306", "# t\n\n![b](https://img.shields.io/badge/l-m-c)\n", 0);
  assertRatio("C306", '# t\n\n<img src="docs/shot.png" width="400">\n', 1);
});

test("C307: a Features or Why section passes; an unlabelled top bullet list earns 0.5", () => {
  assertRatio("C307", "# t\n\n## Features\n\n- a\n", 1);
  assertRatio("C307", "# t\n\n## Why t?\n\nBecause.\n", 1);
  assertRatio("C307", "# t\n\n- fast\n- small\n- offline\n", 0.5);
  assertRatio("C307", "# t\n\nplain prose only\n", 0);
});

test("C308: deeper-docs links or a Documentation heading pass; standard repo files do not count", () => {
  assertRatio("C308", "# t\n\nSee [the guide](docs/guide.md).\n", 1);
  assertRatio("C308", "# t\n\nSee [docs](https://example.test/docs/).\n", 1);
  assertRatio("C308", "# t\n\n## Documentation\n\nEverything lives here.\n", 1);
  assertRatio("C308", "# t\n\nSee [license](LICENSE.md) and [changelog](CHANGELOG.md).\n", 0);
});
