# How readmeter scores

## The model

Each of the 23 checks has a fixed integer weight; the weights sum to
exactly 100 (asserted by the test suite). Running a check yields a ratio
between 0 and 1:

- **pass** — ratio 1, full weight earned;
- **partial** — a documented tier such as 0.5 for "install command present
  but no Install heading" (every tier is listed in [checks.md](checks.md));
- **fail** — ratio 0;
- **skip** — the check does not apply (for example H403 on stdin input, or
  C301 when there are no code blocks at all).

The final score is:

```text
score = round(100 * earned / applicable)
```

where `applicable` is the summed weight of all checks that actually ran.
Skipped and disabled checks are removed from the denominator, so a README
is never charged for a check that could not apply to it — and never
padded by one either.

## Grades

| Score | Grade |
|---|---|
| 90–100 | A |
| 80–89 | B |
| 70–79 | C |
| 60–69 | D |
| 0–59 | F |

The `badge` subcommand maps the same bands to shields.io colors
(brightgreen / green / yellow / orange / red).

## The fix list

Every failed or partial check contributes one entry to the fix list,
ordered by recoverable points (weight minus points earned), ties broken
by code. The advice string is the most specific one the check produced —
"Group the command under an explicit Install heading" rather than a
generic platitude, whenever the check knows more.

## Determinism

Same input bytes, same flags, same score — always. There is no wall
clock, no randomness and no network anywhere in the scoring path; the
test suite asserts byte-identical repeated runs. This is what makes
`--min-score` usable as a CI gate: a score change always means the README
(or readmeter's version) changed.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | scored (and the `--min-score` gate, if any, passed) |
| 1 | score below `--min-score` (from the flag or `.readmeter.json`) |
| 2 | usage, config or I/O error (bad flag, unknown check code, missing file) |

## Skips vs. zeros — the philosophy

A check skips only when the *precondition for judging* is absent, not
when the answer is "no". No install section is a fail (E103) — the README
should have one. No code blocks at all makes C301 (fence tags)
meaningless, so it skips. This keeps scores comparable across very
different projects while never hiding a real defect behind a technicality.
