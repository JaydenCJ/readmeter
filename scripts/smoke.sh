#!/usr/bin/env bash
# Smoke test for readmeter: exercises the real CLI end to end against the
# bundled example READMEs. No network, idempotent, runs from a clean
# checkout (after `npm install`). Prints "SMOKE OK" on success.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$(pwd)"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

fail() {
  echo "SMOKE FAIL: $1" >&2
  exit 1
}

# 1. Build (idempotent).
npm run build >/dev/null 2>&1 || fail "npm run build failed"
CLI="node $ROOT/dist/cli.js"
echo "[smoke] build ok"

# 2. --version matches package.json; --help documents every subcommand.
PKG_VERSION="$(node -p "require('$ROOT/package.json').version")"
CLI_VERSION="$($CLI --version)"
[ "$CLI_VERSION" = "$PKG_VERSION" ] || fail "--version mismatch: $CLI_VERSION != $PKG_VERSION"
HELP="$($CLI --help)"
for word in score checks explain badge; do
  echo "$HELP" | grep -q "$word" || fail "--help missing $word"
done
echo "[smoke] --help/--version ok ($CLI_VERSION)"

# 3. The good example grades A with every check passing.
GOOD_OUT="$($CLI score examples/good/README.md)"
echo "$GOOD_OUT" | grep -q 'grade A' || fail "good example did not grade A"
echo "$GOOD_OUT" | grep -q 'top fixes: none' || fail "good example should need no fixes"
echo "[smoke] good example ok ($(echo "$GOOD_OUT" | grep -o 'score [0-9]*/100'))"

# 4. The bad example grades F and names its worst defects with line numbers.
set +e
BAD_OUT="$($CLI score examples/bad/README.md)"; BAD_CODE=$?
set -e
[ "$BAD_CODE" -eq 0 ] || fail "score without --min-score should exit 0, got $BAD_CODE"
echo "$BAD_OUT" | grep -q 'grade F' || fail "bad example did not grade F"
echo "$BAD_OUT" | grep -q 'E103 install-steps' || fail "missing E103 finding"
echo "$BAD_OUT" | grep -q '"TODO" at line 19' || fail "missing TODO placeholder line"
echo "$BAD_OUT" | grep -q 'broken link "docs/setup.md"' || fail "missing broken-link finding"
echo "[smoke] bad example ok ($(echo "$BAD_OUT" | grep -o 'score [0-9]*/100'))"

# 5. --min-score gates in CI style: pass exits 0, fail exits 1 with stderr.
$CLI score examples/good/README.md --min-score 90 >/dev/null || fail "good example should clear --min-score 90"
set +e
GATE_ERR="$($CLI score examples/bad/README.md --min-score 90 2>&1 >/dev/null)"; GATE_CODE=$?
set -e
[ "$GATE_CODE" -eq 1 ] || fail "bad example should exit 1 under --min-score 90, got $GATE_CODE"
echo "$GATE_ERR" | grep -q 'below the minimum 90' || fail "gate message missing"
echo "[smoke] --min-score gate ok (exit 1)"

# 6. JSON output parses and carries the same score; runs are byte-identical.
$CLI score examples/good/README.md --format json > "$WORKDIR/a.json"
node -e "const r=require('$WORKDIR/a.json'); if (r.grade!=='A'||r.checks.length!==23) process.exit(1)" \
  || fail "JSON report malformed"
$CLI score examples/good/README.md --format json > "$WORKDIR/b.json"
cmp -s "$WORKDIR/a.json" "$WORKDIR/b.json" || fail "JSON output not deterministic"
echo "[smoke] json + determinism ok"

# 7. checks lists the full checklist; explain documents a single rule.
$CLI checks | grep -q 'E105  license-stated' || fail "checks table missing E105"
[ "$($CLI checks | grep -c '^[ESCH][0-9]')" -eq 23 ] || fail "checks table should list 23 checks"
$CLI explain H403 | grep -q 'why it matters:' || fail "explain missing rationale"
echo "[smoke] checks/explain ok (23 checks)"

# 8. Config file: disable + minScore both honored from .readmeter.json.
mkdir -p "$WORKDIR/proj"
cp examples/bad/README.md "$WORKDIR/proj/README.md"
printf '{"disable": ["C302"], "minScore": 95}\n' > "$WORKDIR/proj/.readmeter.json"
set +e
(cd "$WORKDIR/proj" && $CLI score README.md >"$WORKDIR/cfg.out" 2>/dev/null); CFG_CODE=$?
set -e
[ "$CFG_CODE" -eq 1 ] || fail "config minScore should gate with exit 1, got $CFG_CODE"
grep -q '1 disabled' "$WORKDIR/cfg.out" || fail "config disable not applied"
echo "[smoke] config file ok"

# 9. stdin scoring works and skips the link check instead of guessing.
printf '# x\n\nSee [the docs](docs/guide.md) for details.\n' | $CLI score - | grep -q 'relative-links-resolve  skip' \
  || fail "stdin should skip H403"
echo "[smoke] stdin ok"

# 10. badge emits ready-to-paste markdown pointing at shields.io.
$CLI badge examples/good/README.md | grep -q '^!\[readme score\](https://img.shields.io/badge/readme_score-' \
  || fail "badge markdown malformed"
echo "[smoke] badge ok"

# 11. Error handling: bad files and bad flags exit 2.
set +e
$CLI score "$WORKDIR/nope.md" >/dev/null 2>&1; [ $? -eq 2 ] || { set -e; fail "missing file should exit 2"; }
$CLI --frobnicate >/dev/null 2>&1; [ $? -eq 2 ] || { set -e; fail "unknown flag should exit 2"; }
$CLI explain Z999 >/dev/null 2>&1; [ $? -eq 2 ] || { set -e; fail "unknown code should exit 2"; }
set -e
echo "[smoke] error handling ok (exit 2)"

echo "SMOKE OK"
