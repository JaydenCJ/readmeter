// Shared test helpers: run a single check or the whole engine against an
// in-memory README string. No temp files, no network — a fake fileExists
// probe stands in for the project directory.
import { strict as assert } from "node:assert";
import { analyze, CHECKS, parseMarkdown } from "../dist/index.js";

/** Look up a check by code; throws when the code does not exist. */
export function check(code) {
  const found = CHECKS.find((c) => c.code === code);
  assert.ok(found, `no such check: ${code}`);
  return found;
}

/**
 * Run one check against a README string. `files` is the list of relative
 * paths that "exist" in the fake project directory; pass null to simulate
 * stdin input with no project directory at all.
 */
export function runCheck(code, markdown, files = []) {
  const ctx = {
    doc: parseMarkdown(markdown),
    filePath: files === null ? null : "README.md",
    projectDir: files === null ? null : "/project",
    fileExists: (rel) => files !== null && files.includes(rel),
  };
  return check(code).run(ctx);
}

/** Assert a check's earned ratio (skip results fail the assertion). */
export function assertRatio(code, markdown, expected, files = []) {
  const run = runCheck(code, markdown, files);
  assert.ok(!("skip" in run), `${code} unexpectedly skipped: ${run.skip}`);
  assert.equal(run.ratio, expected, `${code} ratio (evidence: ${run.evidence.join("; ")})`);
  return run;
}

/** Full-engine convenience wrapper with a fake project directory. */
export function analyzeWith(markdown, files = [], options = {}) {
  return analyze(markdown, {
    filePath: "README.md",
    projectDir: "/project",
    fileExists: (rel) => files.includes(rel),
    ...options,
  });
}

/** A README that passes every check (mirrors examples/good, condensed). */
export const GOOD = `# driftwood

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**driftwood archives your bookmarks as plain files on your own disk, full-text searchable and offline forever.**

![preview](docs/preview.svg)

Browser bookmarks rot: pages move, sites die, and export formats change
every year. driftwood fetches each page once, stores a readable snapshot
next to a small metadata file, and gives you fast local search across
everything you ever saved. Requires Node.js >= 20 and nothing else at all.

## Features

- **Plain files** — every bookmark is a folder you can grep and back up.
- **Full-text search** — answers in milliseconds, entirely offline.
- **Import everything** — reads Netscape HTML exports from any browser.

## Install

\`\`\`bash
npm install -g driftwood-cli
\`\`\`

## Usage

Import an export file and search the archive with two commands:

\`\`\`bash
driftwood import bookmarks.html
driftwood find "static sites"
\`\`\`

Output:

\`\`\`text
imported 312 bookmarks (9 duplicates skipped)
3 matches found in the local archive
\`\`\`

See [docs/configuration.md](docs/configuration.md) for every setting knob.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) for the test workflow please.

## License

[MIT](LICENSE)
`;

/** The relative files GOOD links to. */
export const GOOD_FILES = [
  "LICENSE",
  "CONTRIBUTING.md",
  "docs/preview.svg",
  "docs/configuration.md",
];
