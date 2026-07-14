// Parser tests: headings (ATX + setext), fenced code blocks, links in all
// supported syntaxes, badges, bare URLs, front matter, word counts and
// section geometry — each with exact 1-based line numbers.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  deepSectionEnd,
  findSections,
  isBadgeUrl,
  parseMarkdown,
  sectionCodeBlocks,
  stripInlineCode,
} from "../dist/index.js";

test("ATX headings carry level, text and line; CRLF parses identically to LF", () => {
  const doc = parseMarkdown("# One\n\ntext\n\n## Two ##\n\n### Three\n");
  assert.deepEqual(
    doc.headings.map((h) => [h.level, h.text, h.line]),
    [
      [1, "One", 1],
      [2, "Two", 5],
      [3, "Three", 7],
    ]
  );
  const crlf = parseMarkdown("# One\r\n\r\ntext\r\n\r\n## Two ##\r\n\r\n### Three\r\n");
  assert.deepEqual(crlf.headings, doc.headings);
  assert.equal(crlf.lineCount, doc.lineCount);
});

test("setext headings are recognized; rules after blanks and table separators are not", () => {
  const doc = parseMarkdown("Title\n=====\n\nSection\n-------\n\nbody\n");
  assert.deepEqual(
    doc.headings.map((h) => [h.level, h.text, h.line]),
    [
      [1, "Title", 1],
      [2, "Section", 4],
    ]
  );
  // `---` after a blank line is a thematic break, not a heading.
  assert.equal(parseMarkdown("# T\n\npara\n\n---\n\nmore\n").headings.length, 1);
  // Table separator rows never promote the header row to a heading.
  assert.equal(parseMarkdown("# T\n\n| a | b |\n|---|---|\n| 1 | 2 |\n").headings.length, 1);
});

test("headings inside code fences are content, not structure", () => {
  const doc = parseMarkdown("# Real\n\n```md\n# fake\n## also fake\n```\n");
  assert.equal(doc.headings.length, 1);
  assert.equal(doc.codeBlocks.length, 1);
  assert.deepEqual(doc.codeBlocks[0].lines, ["# fake", "## also fake"]);
});

test("fences: lowercased info tags, unclosed blocks, and nested shorter fences", () => {
  const doc = parseMarkdown("```Bash\nx\n```\n\n~~~text extra words\ny\n~~~\n\n```\nz\n```\n");
  assert.deepEqual(
    doc.codeBlocks.map((b) => b.lang),
    ["bash", "text", ""]
  );
  // An unclosed fence swallows the rest of the file (nothing below is structure).
  const open = parseMarkdown("# T\n\n```js\nlet a = 1;\n# not a heading\n");
  assert.equal(open.headings.length, 1);
  assert.equal(open.codeBlocks[0].closed, false);
  assert.equal(open.codeBlocks[0].endLine, 5);
  // A 4-backtick fence contains a 3-backtick fence verbatim.
  const nested = parseMarkdown("````md\n```\ninner\n```\n````\nafter\n");
  assert.equal(nested.codeBlocks.length, 1);
  assert.equal(nested.codeBlocks[0].closed, true);
  assert.deepEqual(nested.codeBlocks[0].lines, ["```", "inner", "```"]);
});

test("inline links, images, autolinks and reference links are all collected", () => {
  const md = [
    "# T",
    "",
    "See [docs](docs/a.md) and ![shot](img/s.png).",
    "Auto: <https://example.test/x>",
    "Ref [guide][g] and collapsed [manual][].",
    "",
    "[g]: https://example.test/guide",
    "[manual]: docs/manual.md",
  ].join("\n");
  const doc = parseMarkdown(md);
  const urls = doc.links.map((l) => l.url).sort();
  assert.deepEqual(urls, [
    "docs/a.md",
    "docs/manual.md",
    "https://example.test/guide",
    "https://example.test/x",
    "img/s.png",
  ]);
  const image = doc.links.find((l) => l.image);
  assert.equal(image.url, "img/s.png");
  assert.equal(image.line, 3);
});

test("inline code hides links and URLs; only genuinely bare URLs are reported", () => {
  // stripInlineCode blanks single and double backtick spans, preserving length.
  const s = "a `b` c ``d `e` f`` g";
  const stripped = stripInlineCode(s);
  assert.equal(stripped.length, s.length);
  assert.ok(!stripped.includes("b") && !stripped.includes("e"));
  const code = parseMarkdown("# T\n\nrun `curl https://example.test` and `[x](y)`\n");
  assert.equal(code.links.length, 0);
  assert.equal(code.bareUrls.length, 0);
  const md = "# T\n\nplain https://example.test/a here\n[ok](https://example.test/b)\n<https://example.test/c>\n";
  assert.deepEqual(parseMarkdown(md).bareUrls, [{ url: "https://example.test/a", line: 3 }]);
});

test("badge images are separated from content images, even nested inside links", () => {
  const md =
    "# T\n\n[![L](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)\n\n![shot](docs/shot.png)\n";
  const doc = parseMarkdown(md);
  assert.equal(doc.badges.length, 1);
  assert.ok(isBadgeUrl(doc.badges[0].url));
  assert.ok(!isBadgeUrl("docs/shot.png"));
  // The wrapping link survives the nested image extraction.
  const license = doc.links.find((l) => !l.image && l.url === "LICENSE");
  assert.ok(license, "outer LICENSE link collected");
});

test("YAML front matter is invisible to headings, links and prose", () => {
  const md = "---\ntitle: TODO\nlink: https://example.test\n---\n# Real\n\nbody text\n";
  const doc = parseMarkdown(md);
  assert.equal(doc.hasFrontMatter, true);
  assert.equal(doc.headings[0].line, 5);
  assert.equal(doc.bareUrls.length, 0);
  assert.ok(doc.prose.every((p) => p.line >= 5));
});

test("word count covers prose and headings but not code or URLs", () => {
  const doc = parseMarkdown(
    "# Two Words\n\nthree more words https://example.test/skip\n\n```bash\nnot counted at all\n```\n"
  );
  assert.equal(doc.wordCount, 5);
});

test("sections track flat content ranges and non-blank line counts", () => {
  const md = "# T\n\nintro\n\n## A\n\nline1\n\nline2\n\n## B\n";
  const doc = parseMarkdown(md);
  const a = doc.sections.find((s) => s.heading.text === "A");
  assert.equal(a.contentStart, 6);
  assert.equal(a.contentEnd, 10);
  assert.equal(a.contentLines, 2);
  const b = doc.sections.find((s) => s.heading.text === "B");
  assert.equal(b.contentLines, 0);
});

test("deepSectionEnd spans subsections; sectionCodeBlocks sees nested blocks", () => {
  const md = "## Install\n\n### npm\n\n```bash\nnpm i x\n```\n\n## Next\n";
  const doc = parseMarkdown(md);
  const install = findSections(doc, /^install/i)[0];
  assert.equal(deepSectionEnd(doc, install), 8);
  assert.equal(sectionCodeBlocks(doc, install).length, 1);
});
