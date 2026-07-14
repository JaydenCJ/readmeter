// Hygiene checks (H4xx): placeholders, leaked local paths, broken relative
// links, bare URLs and duplicate headings. The failure cases here mirror
// the exact defects examples/bad/README.md ships with.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assertRatio, runCheck } from "./helpers.mjs";

test("H401: TODO / FIXME / coming soon / your-username all fail with line numbers", () => {
  const run = assertRatio("H401", "# t\n\nTODO: finish this\n\ncoming soon!\n", 0);
  assert.match(run.evidence[0], /"TODO" at line 3/);
  assert.match(run.evidence[1], /"coming soon" at line 5/);
  assertRatio("H401", "# t\n\nclone it as your-username/fork\n", 0);
});

test("H401: placeholders inside code are allowed; clean prose passes", () => {
  assertRatio(
    "H401",
    "# t\n\n```bash\nexport KEY=<insert key here>  # TODO\n```\n\nuse `TODO` markers\n",
    1
  );
  assertRatio("H401", "# t\n\nEverything here is finished text.\n", 1);
});

test("H402: unix and windows home-directory paths fail, generic paths pass", () => {
  assertRatio("H402", "# t\n\n```\nreading /home/alice/data.csv\n```\n", 0);
  assertRatio("H402", "# t\n\nlogs at C:\\Users\\bob\\logs\\out.txt\n", 0);
  assertRatio("H402", "# t\n\nput it in /path/to/project or /etc/tool/\n", 1);
});

test("H403: resolving links pass, missing targets are proportional and listed", () => {
  assertRatio("H403", "# t\n\n[a](docs/a.md) and [b](docs/b.md)\n", 1, ["docs/a.md", "docs/b.md"]);
  const run = assertRatio("H403", "# t\n\n[a](docs/a.md) and [b](docs/b.md)\n", 0.5, ["docs/a.md"]);
  assert.match(run.evidence[0], /broken link "docs\/b.md" at line 3/);
});

test("H403: anchors, external URLs and query strings are handled; stdin input skips", () => {
  const md = "# t\n\n[x](#usage) [y](https://example.test/) [z](mailto:dev@example.test)\n";
  const none = assertRatio("H403", md, 1);
  assert.match(none.evidence[0], /no relative links/);
  assertRatio("H403", "# t\n\n[a](docs/a.md#section) [b](docs/a.md?plain=1)\n", 1, ["docs/a.md"]);
  const skip = runCheck("H403", "# t\n\n[a](docs/a.md)\n", null);
  assert.ok("skip" in skip);
  assert.match(skip.skip, /--project-dir/);
});

test("H404: a few bare URLs earn 0.5, five or more earn 0, none earns 1", () => {
  assertRatio("H404", "# t\n\nall [wrapped](https://example.test/)\n", 1);
  assertRatio("H404", "# t\n\nsee https://example.test/a\n", 0.5);
  const many = Array.from({ length: 5 }, (_, i) => `https://example.test/${i}`).join("\n\n");
  assertRatio("H404", `# t\n\n${many}\n`, 0);
});

test("H405: heading duplicates match case-insensitively; one dup 0.5, two dups 0", () => {
  assertRatio("H405", "# t\n\n## Usage\n\nx\n\n## Advanced usage\n", 1);
  const one = assertRatio("H405", "# t\n\n## Notes\n\nx\n\n## notes\n", 0.5);
  assert.match(one.evidence[0], /"notes" repeats \(lines 3, 7\)/);
  assertRatio("H405", "# t\n\n## A\n\n## a\n\n## B\n\n## b\n", 0);
});
