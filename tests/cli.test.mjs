// End-to-end CLI tests against the compiled dist/cli.js: real process
// spawns in fresh temp directories, asserting stdout, stderr and the
// documented exit codes (0 ok, 1 below --min-score, 2 usage/config/IO).
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");
const PKG = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

const dirs = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** Write a { "rel/path": "content" } map into a fresh temp project dir. */
function makeProject(files) {
  const dir = mkdtempSync(join(tmpdir(), "readmeter-cli-"));
  dirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, ...rel.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    ...options,
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

const DECENT = `# tool

A tiny tool that does one small thing well and nothing else.

## Install

\`\`\`bash
npm install -g tool
\`\`\`

## Usage

\`\`\`bash
tool run input.txt
\`\`\`

## License

MIT, see [LICENSE](LICENSE).
`;

test("--version matches package.json; --help documents every subcommand and exit code", async () => {
  const pkg = JSON.parse((await import("node:fs")).readFileSync(PKG, "utf8"));
  const version = run(["--version"]);
  assert.equal(version.code, 0);
  assert.equal(version.stdout.trim(), pkg.version);
  const help = run(["--help"]);
  assert.equal(help.code, 0);
  for (const word of ["score", "checks", "explain", "badge", "--min-score", "exit codes"]) {
    assert.ok(help.stdout.includes(word), `help mentions ${word}`);
  }
});

test("scoring a decent README exits 0 and prints the report", () => {
  const dir = makeProject({ "README.md": DECENT, LICENSE: "MIT" });
  const { code, stdout } = run([join(dir, "README.md")]);
  assert.equal(code, 0);
  assert.match(stdout, /score \d+\/100 {2}grade [A-F]/);
  assert.match(stdout, /\+ E103 {2}install-steps/);
});

test("the README's directory is the default project dir for link checks", () => {
  const dir = makeProject({ "README.md": DECENT, LICENSE: "MIT" });
  const { stdout } = run([join(dir, "README.md")]);
  assert.match(stdout, /\+ H403 {2}relative-links-resolve.*1 relative link/);
});

test("--min-score below the score exits 0; above it exits 1 with a stderr note", () => {
  const dir = makeProject({ "README.md": DECENT, LICENSE: "MIT" });
  const ok = run([join(dir, "README.md"), "--min-score", "10"]);
  assert.equal(ok.code, 0);
  const gate = run([join(dir, "README.md"), "--min-score", "99"]);
  assert.equal(gate.code, 1);
  assert.match(gate.stderr, /below the minimum 99/);
});

test("--format json emits parseable JSON, byte-identical across repeated runs", () => {
  const dir = makeProject({ "README.md": DECENT, LICENSE: "MIT" });
  const { code, stdout } = run(["score", join(dir, "README.md"), "--format", "json"]);
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.checks.length, 23);
  assert.ok(parsed.score > 0 && parsed.score <= 100);
  const again = run(["score", join(dir, "README.md"), "--format", "json"]);
  assert.equal(again.stdout, stdout);
});

test("stdin input works and skips the relative-link check", () => {
  const { code, stdout } = run(["score", "-"], { input: DECENT });
  assert.equal(code, 0);
  assert.match(stdout, /<stdin>/);
  assert.match(stdout, /- H403 {2}relative-links-resolve {2}skip/);
});

test(".readmeter.json is honored: disable plus minScore gate", () => {
  const dir = makeProject({
    "README.md": DECENT,
    LICENSE: "MIT",
    ".readmeter.json": '{"disable": ["C302", "C306"], "minScore": 99}',
  });
  const { code, stdout, stderr } = run(["score", "README.md"], { cwd: dir });
  assert.equal(code, 1, stderr);
  assert.match(stdout, /2 disabled/);
  assert.ok(!stdout.includes("C306"));
});

test("a broken config file is exit 2 with the offending key named", () => {
  const dir = makeProject({
    "README.md": DECENT,
    ".readmeter.json": '{"minscore": 90}',
  });
  const { code, stderr } = run(["score", "README.md"], { cwd: dir });
  assert.equal(code, 2);
  assert.match(stderr, /unknown key "minscore"/);
});

test("missing files, bad flags and unknown explain codes all exit 2", () => {
  assert.equal(run(["score", "no-such-file.md"]).code, 2);
  assert.equal(run(["--not-a-flag"]).code, 2);
  assert.equal(run(["explain", "Z999"]).code, 2);
  assert.equal(run(["score", "-", "--disable", "NOPE"], { input: "# x\n" }).code, 2);
});

test("badge command prints markdown by default and a bare URL with --format url", () => {
  const dir = makeProject({ "README.md": DECENT, LICENSE: "MIT" });
  const md = run(["badge", join(dir, "README.md")]);
  assert.equal(md.code, 0);
  assert.match(md.stdout, /^!\[readme score\]\(https:\/\/img\.shields\.io\/badge\/readme_score-\d+%2F100-\w+\)\n$/);
  const url = run(["badge", join(dir, "README.md"), "--format", "url", "--label", "docs"]);
  assert.match(url.stdout, /^https:\/\/img\.shields\.io\/badge\/docs-\d+%2F100-\w+\n$/);
});

test("explain E103 prints the full rule documentation (case-insensitive lookup)", () => {
  const { code, stdout } = run(["explain", "e103"]);
  assert.equal(code, 0);
  assert.match(stdout, /E103 install-steps/);
  assert.match(stdout, /why it matters:/);
});
