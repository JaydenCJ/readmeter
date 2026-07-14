# readmeter examples

Two miniature projects for trying readmeter without leaving the checkout.
Both are fictional; their only job is to exercise every check.

## good/ — a README that earns an A

`good/README.md` documents "driftwood", an imaginary bookmark archiver. It
hits every check: a single H1, a bold tagline, badges, an image, install
and usage sections with a captured-output block, stated prerequisites, a
features list, contributing and license links that resolve to real files,
and a link to deeper docs.

```bash
node dist/cli.js score examples/good/README.md
```

## bad/ — a README that fails the way real ones fail

`bad/README.md` collects the most common defects readmeter sees in the
wild: no H1 or license, a `TODO` placeholder, "coming soon", a bare URL, a
broken relative link, a leaked home-directory path inside a terminal dump,
an untagged code fence, a skipped heading level and a duplicated heading.

```bash
node dist/cli.js score examples/bad/README.md
```

## Using them as a CI dry run

The `--min-score` gate turns any invocation into a pass/fail step:

```bash
node dist/cli.js score examples/good/README.md --min-score 90  # exits 0
node dist/cli.js score examples/bad/README.md  --min-score 90  # exits 1
```
