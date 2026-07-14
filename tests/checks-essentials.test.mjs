// One scenario per grading tier of the five essential checks (E1xx):
// title, description, install, usage, license. These carry 43 of the 100
// points, so every tier boundary is pinned explicitly.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assertRatio } from "./helpers.mjs";

test("E101: a single top H1 passes; absence fails", () => {
  assertRatio("E101", "# tool\n\nbody\n", 1);
  const none = assertRatio("E101", "## not a title\n\nbody\n", 0);
  assert.match(none.fix, /# <project-name>/);
});

test("E101: multiple H1s earn 0.4 with lines listed; a buried H1 earns 0.6", () => {
  const multi = assertRatio("E101", "# one\n\ntext\n\n# two\n", 0.4);
  assert.match(multi.evidence[0], /lines 1, 5/);
  assertRatio("E101", "## intro\n\ntext\n\n# actual title\n", 0.6);
});

test("E102: a real sentence under the title passes; badges and images do not count", () => {
  assertRatio("E102", "# t\n\nA linter that grades README files for you.\n", 1);
  assertRatio(
    "E102",
    "# t\n\n![b](https://img.shields.io/badge/a-b-c)\n\n## Install\n",
    0
  );
});

test("E102: a blockquote tagline counts; a buried description earns 0.4", () => {
  assertRatio("E102", "# t\n\n> Grades README files against a documented checklist.\n", 1);
  const md =
    "# t\n\n## Install\n\nnothing\n\n## About\n\nThis tool grades README files against a checklist.\n";
  assertRatio("E102", md, 0.4);
});

test("E103: an install-family heading with a package-manager command passes, subsections included", () => {
  assertRatio("E103", "# t\n\n## Install\n\n```bash\nnpm install t\n```\n", 1);
  assertRatio("E103", "# t\n\n## Getting started\n\n```bash\npip install t\n```\n", 1);
  const nested =
    "# t\n\n## Installation\n\n### From source\n\n```bash\ngit clone https://example.test/t.git\n```\n";
  assertRatio("E103", nested, 1);
});

test("E103: tiers — code without a known command 0.7, no code 0.4, command without heading 0.5, nothing 0", () => {
  assertRatio("E103", "# t\n\n## Install\n\n```bash\n./configure && ./build.sh\n```\n", 0.7);
  assertRatio("E103", "# t\n\n## Install\n\nJust download it somewhere.\n", 0.4);
  assertRatio("E103", "# t\n\n## Stuff\n\n```bash\nnpm install t\n```\n", 0.5);
  assertRatio("E103", "# t\n\nno commands here\n", 0);
});

test("E104: usage heading with a code example passes; without code earns 0.4", () => {
  assertRatio("E104", "# t\n\n## Usage\n\n```bash\nt run input.txt\n```\n", 1);
  assertRatio("E104", "# t\n\n## Usage\n\nCall it with a file.\n", 0.4);
});

test("E104: a stray demo block earns 0.5; setup-only blocks do not count as usage", () => {
  assertRatio("E104", "# t\n\n## Notes\n\n```bash\nt run input.txt\n```\n", 0.5);
  assertRatio(
    "E104",
    "# t\n\n## Notes\n\n```bash\ngit clone https://example.test/t.git\ncd t\nnpm install\n```\n",
    0
  );
});

test("E105: a License section passes; an empty one earns 0.7", () => {
  assertRatio("E105", "# t\n\n## License\n\nMIT, see LICENSE.\n", 1);
  assertRatio("E105", "# t\n\nbody\n\n## License\n", 0.7);
});

test("E105: fallbacks — mention 0.7, unreferenced LICENSE file 0.4, nothing 0 (also with no project dir)", () => {
  assertRatio("E105", "# t\n\nReleased under the MIT license.\n", 0.7);
  assertRatio("E105", "# t\n\nno mention\n", 0.4, ["LICENSE"]);
  assertRatio("E105", "# t\n\nno mention\n", 0, []);
  // Without a project directory the LICENSE-file fallback is unavailable.
  assertRatio("E105", "# t\n\nno mention\n", 0, null);
});
