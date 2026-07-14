// Argument parser: subcommand routing, the file shorthand, flag values
// and every rejection path (all UsageError -> exit 2 in the CLI).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseArgs, UsageError } from "../dist/index.js";

test("no arguments scores ./README.md; a bare path is shorthand for score", () => {
  const args = parseArgs([]);
  assert.equal(args.command, "score");
  assert.equal(args.file, "README.md");
  assert.equal(args.format, "text");
  assert.equal(parseArgs(["docs/README.md"]).file, "docs/README.md");
  assert.equal(parseArgs(["docs/README.md"]).command, "score");
  assert.equal(parseArgs(["-"]).file, "-");
});

test("explicit subcommands parse with their arguments", () => {
  assert.equal(parseArgs(["score", "x.md"]).file, "x.md");
  assert.equal(parseArgs(["checks"]).command, "checks");
  assert.deepEqual(
    [parseArgs(["explain", "E103"]).command, parseArgs(["explain", "E103"]).code],
    ["explain", "E103"]
  );
  assert.equal(parseArgs(["badge", "x.md"]).command, "badge");
});

test("--help and --version win regardless of position", () => {
  assert.equal(parseArgs(["score", "--help"]).command, "help");
  assert.equal(parseArgs(["-V"]).command, "version");
});

test("--format routes to report format or badge format by value", () => {
  assert.equal(parseArgs(["score", "--format", "json"]).format, "json");
  assert.equal(parseArgs(["badge", "--format", "url"]).badgeFormat, "url");
  assert.throws(() => parseArgs(["score", "--format", "yaml"]), UsageError);
});

test("--min-score validates its integer range", () => {
  assert.equal(parseArgs(["--min-score", "80"]).minScore, 80);
  assert.throws(() => parseArgs(["--min-score", "abc"]), UsageError);
  assert.throws(() => parseArgs(["--min-score", "101"]), UsageError);
  assert.throws(() => parseArgs(["--min-score"]), UsageError);
});

test("--disable accumulates and splits comma lists", () => {
  const args = parseArgs(["--disable", "C306,H404", "--disable", "E101"]);
  assert.deepEqual(args.disable, ["C306", "H404", "E101"]);
});

test("unknown options, unknown commands and excess arguments are rejected", () => {
  assert.throws(() => parseArgs(["--frobnicate"]), UsageError);
  assert.throws(() => parseArgs(["a.md", "b.md"]), UsageError);
  assert.throws(() => parseArgs(["checks", "extra"]), UsageError);
  assert.throws(() => parseArgs(["explain"]), UsageError);
  assert.throws(() => parseArgs(["score", "a.md", "b.md"]), UsageError);
});
