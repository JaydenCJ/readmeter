// Config loader: strict validation (unknown keys, wrong types, unknown
// check codes are hard errors) plus the explicit/implicit file lookup.
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ConfigError, loadConfig, parseConfig, validateCodes } from "../dist/index.js";

test("a full valid config parses with codes normalized to uppercase", () => {
  const config = parseConfig('{"disable": ["c306", "H404"], "minScore": 85}', "test");
  assert.deepEqual(config.disable, ["C306", "H404"]);
  assert.equal(config.minScore, 85);
});

test("an empty object yields the defaults", () => {
  const config = parseConfig("{}", "test");
  assert.deepEqual(config, { disable: [], minScore: null });
});

test("unknown keys, wrong types and non-object roots are hard errors", () => {
  assert.throws(() => parseConfig('{"disabel": []}', "t"), /unknown key "disabel"/);
  assert.throws(() => parseConfig('{"disable": "C306"}', "t"), /array of check codes/);
  assert.throws(() => parseConfig('{"minScore": "80"}', "t"), /integer between 0 and 100/);
  assert.throws(() => parseConfig('{"minScore": 101}', "t"), /integer between 0 and 100/);
  assert.throws(() => parseConfig("[]", "t"), /top level must be a JSON object/);
  assert.throws(() => parseConfig("not json", "t"), /invalid JSON/);
});

test("unknown check codes are rejected with a pointer to `readmeter checks`", () => {
  assert.throws(() => parseConfig('{"disable": ["E999"]}', "t"), /unknown check code "E999"/);
  assert.throws(() => validateCodes(["nope"], "cli"), /readmeter checks/);
});

test("loadConfig: finds .readmeter.json, defaults when absent, errors on a missing explicit path", () => {
  const dir = mkdtempSync(join(tmpdir(), "readmeter-test-"));
  try {
    const before = loadConfig(null, dir);
    assert.equal(before.path, null);
    assert.deepEqual(before.config, { disable: [], minScore: null });
    writeFileSync(join(dir, ".readmeter.json"), '{"minScore": 70}');
    const { config, path } = loadConfig(null, dir);
    assert.equal(config.minScore, 70);
    assert.equal(path, join(dir, ".readmeter.json"));
    assert.throws(() => loadConfig(join(dir, "nope.json"), dir), ConfigError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
