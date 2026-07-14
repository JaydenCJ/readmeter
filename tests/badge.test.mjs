// Badge generation: shields.io escaping, grade-band colors and the
// markdown/url output shapes. Pure string work — nothing is fetched.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { badgeColor, badgeMarkdown, badgeUrl, shieldsEscape } from "../dist/index.js";

test("shieldsEscape doubles dashes and underscores and encodes spaces", () => {
  assert.equal(shieldsEscape("readme score"), "readme_score");
  assert.equal(shieldsEscape("a-b"), "a--b");
  assert.equal(shieldsEscape("a_b"), "a__b");
  assert.equal(shieldsEscape("87/100"), "87%2F100");
});

test("badge colors track the grade bands", () => {
  assert.equal(badgeColor(95), "brightgreen");
  assert.equal(badgeColor(90), "brightgreen");
  assert.equal(badgeColor(85), "green");
  assert.equal(badgeColor(72), "yellow");
  assert.equal(badgeColor(60), "orange");
  assert.equal(badgeColor(42), "red");
});

test("badgeUrl builds a static shields.io URL with the escaped message", () => {
  assert.equal(
    badgeUrl(87),
    "https://img.shields.io/badge/readme_score-87%2F100-green"
  );
});

test("badgeMarkdown wraps the URL in an image and escapes custom labels", () => {
  assert.equal(
    badgeMarkdown(93, "docs"),
    "![docs](https://img.shields.io/badge/docs-93%2F100-brightgreen)"
  );
  assert.ok(badgeMarkdown(50, "my readme").includes("my_readme-50%2F100-red"));
});
