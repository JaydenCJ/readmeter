# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-07-12

### Added

- `readmeter score`: grades a README 0-100 against 23 documented checks in
  four categories — essentials (43 pts), structure (15), content (26),
  hygiene (16) — with letter grades, per-category subtotals, line-numbered
  evidence and a fix list ordered by recoverable points.
- Documented partial-credit tiers per check (e.g. an install command with
  no Install heading earns half) and skip semantics with denominator
  renormalization, so inapplicable checks never charge or pad a score.
- Fence-aware Markdown scanner: ATX and setext headings, nested and
  unclosed fences, inline/reference/autolink links, badge-vs-image
  separation (including badges nested inside links), bare-URL detection,
  YAML front matter and prose word counts — all with stable line numbers.
- CI gating: `--min-score N` exits 1 below the threshold; exit codes are
  0 ok / 1 gate failed / 2 usage-config-IO, shared by all subcommands.
- `readmeter checks` (text/JSON checklist), `readmeter explain <code>`
  (per-rule rationale and remediation) and `readmeter badge`
  (offline shields.io badge markdown/URL colored by grade band).
- Strict `.readmeter.json` config (`disable`, `minScore`): unknown keys,
  wrong types and unknown check codes are hard errors.
- stdin scoring (`readmeter score -`) with honest skipping of
  filesystem-dependent checks unless `--project-dir` is given.
- Public programmatic API (`analyze`, `parseMarkdown`, `CHECKS`,
  `renderText`, `renderJson`, `badgeUrl`) with type declarations.
- Bundled example projects (`examples/good`, `examples/bad`) that grade
  A and F respectively, used by the docs and the smoke test.
- Test suite: 85 node:test tests (parser, every check tier, scoring
  invariants, renderers, config, CLI integration in fresh temp dirs) and
  an end-to-end `scripts/smoke.sh`.

[0.1.0]: https://github.com/JaydenCJ/readmeter/releases/tag/v0.1.0
