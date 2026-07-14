# Contributing to readmeter

Issues, discussions and pull requests are all welcome — this project aims
to stay small, zero-dependency at runtime, and honest about what it grades.

## Getting started

Requirements: Node.js >= 22.13 (for the stable `node:test` runner used by the suite).

```bash
git clone https://github.com/JaydenCJ/readmeter.git
cd readmeter
npm install            # installs typescript, the only devDependency
npm run build          # compile TypeScript to dist/
npm test               # build + 85 node:test tests
bash scripts/smoke.sh  # end-to-end CLI check against examples/
```

`scripts/smoke.sh` exercises the real CLI (scoring both bundled examples,
the --min-score gate, JSON output, config files, stdin, badge generation
and every exit code) and must print `SMOKE OK`.

## Before you open a pull request

1. `npx tsc -p tsconfig.json --noEmit` — the tree must type-check clean (strict mode is enforced).
2. `npm test` — all tests must pass.
3. `bash scripts/smoke.sh` — must print `SMOKE OK`.
4. Add tests for behavior changes; keep logic in pure, unit-testable
   modules (parsing and checks take strings and injected probes, not file
   handles).
5. A new check needs: a stable unused code, a weight taken from an
   existing check or a documented rebalance (weights must still sum to
   100), a section in `docs/checks.md`, and one test per grading tier.

## Ground rules

- **No runtime dependencies.** The zero-dependency install is a core
  feature; adding one needs justification in the PR and will usually be
  declined.
- No network calls, ever — the tool reads local files and writes stdout.
- Check codes (`E1xx`/`S2xx`/`C3xx`/`H4xx`) are stable API: never
  renumber or repurpose an existing code; add new ones instead.
- Keep output deterministic: same input bytes and flags must produce
  byte-identical reports (the suite asserts this).
- Code comments and doc comments are written in English.

## Reporting bugs

Please include: `readmeter --version` output, the exact command line, the
README (or a minimal fragment) that mis-scores, and which check code you
believe is wrong. For parser bugs, the smallest Markdown snippet that
misparses is the most useful artifact.

## Security

Do not open public issues for security problems; use GitHub private
vulnerability reporting on this repository instead.
