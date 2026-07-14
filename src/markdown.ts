/**
 * Fence-aware, zero-dependency Markdown scanner. Deliberately not a full
 * CommonMark parser: it extracts exactly the structure the checklist needs
 * (headings, fenced code blocks, links/images/badges, bare URLs, prose
 * lines and a word count) with stable 1-based line numbers, and it never
 * mistakes content inside a code fence or YAML front matter for structure.
 *
 * Supported link syntaxes: inline `[t](u)`, images `![a](u)`, autolinks
 * `<https://u>`, and full/collapsed reference links with their definitions.
 * Shortcut references (`[label]` alone) are ignored on purpose — they are
 * indistinguishable from task-list brackets without full parsing.
 */

import type {
  CodeBlock,
  Heading,
  LinkRef,
  MarkdownDoc,
  Section,
} from "./types.js";

const ATX_RE = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const SETEXT_H1_RE = /^ {0,3}=+\s*$/;
const SETEXT_H2_RE = /^ {0,3}-{2,}\s*$/;
const LIST_ITEM_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s/;
const REF_DEF_RE = /^ {0,3}\[([^\]]+)\]:\s*(\S+)/;
// Images are extracted before links so `[![alt](badge)](target)` yields
// both the badge image and the target link instead of one mangled link.
const IMAGE_RE = /!\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+["'][^)]*["'])?\s*\)/g;
const LINK_RE = /\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+["'][^)]*["'])?\s*\)/g;
const REF_LINK_RE = /(!?)\[([^\]]+)\]\[([^\]]*)\]/g;
const AUTOLINK_RE = /<(https?:\/\/[^>\s]+)>/g;
const BARE_URL_RE = /https?:\/\/[^\s<>()"'\]]+/g;
const BADGE_URL_RE =
  /shields\.io|badgen\.net|badge\.fury\.io|badge\.svg|\/badge\/|\/badges\/|travis-ci\.|circleci\.com|cirrus-ci\.com|codecov\.io|coveralls\.io|appveyor\.com|readthedocs\.(io|org)/i;

/** True when an image URL points at a status-badge service. */
export function isBadgeUrl(url: string): boolean {
  return BADGE_URL_RE.test(url);
}

/** Blank out `code` spans so their content is never scanned as prose. */
export function stripInlineCode(text: string): string {
  return text.replace(/``[^`]*``|`[^`]*`/g, (m) => " ".repeat(m.length));
}

/** Trim a trailing punctuation tail that regex-greedy URL matching drags in. */
function trimUrlTail(url: string): string {
  return url.replace(/[.,;:!?]+$/, "");
}

function at(lines: string[], idx: number): string {
  const value = lines[idx];
  return value === undefined ? "" : value;
}

interface PendingRef {
  image: boolean;
  text: string;
  label: string;
  line: number;
}

/**
 * A line "looks like a paragraph" when a setext underline beneath it should
 * promote it to a heading (CommonMark-lite: not blank, not a list item,
 * not itself structural markup).
 */
function isParagraphish(line: string): boolean {
  if (line.trim() === "") return false;
  if (ATX_RE.test(line)) return false;
  if (LIST_ITEM_RE.test(line)) return false;
  if (FENCE_OPEN_RE.test(line)) return false;
  if (REF_DEF_RE.test(line)) return false;
  if (line.trimStart().startsWith(">")) return false;
  if (line.includes("|")) return false; // table rows
  return true;
}

/** Parse raw Markdown into the document model the checks consume. */
export function parseMarkdown(raw: string): MarkdownDoc {
  let lines = raw.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  if (lines.length > 0 && lines[lines.length - 1] === "" && raw.endsWith("\n")) {
    lines = lines.slice(0, -1);
  }

  // YAML front matter: a leading `---` fence closed by `---` or `...`.
  let frontMatterEnd = 0; // 1-based last line of front matter, 0 when absent
  if (at(lines, 0).trim() === "---") {
    for (let i = 1; i < Math.min(lines.length, 100); i++) {
      const t = at(lines, i).trim();
      if (t === "---" || t === "...") {
        frontMatterEnd = i + 1;
        break;
      }
    }
  }

  const headings: Heading[] = [];
  const codeBlocks: CodeBlock[] = [];
  const links: LinkRef[] = [];
  const bareUrls: { url: string; line: number }[] = [];
  const prose: { line: number; text: string }[] = [];
  const refDefs = new Map<string, string>();
  const pendingRefs: PendingRef[] = [];
  let wordCount = 0;

  let fence: { char: string; len: number; block: CodeBlock } | null = null;
  let skipNext = false; // set when a setext underline was consumed

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = at(lines, i);

    if (lineNo <= frontMatterEnd) continue;
    if (skipNext) {
      skipNext = false;
      continue;
    }

    // --- inside a fenced code block ---
    if (fence !== null) {
      const trimmed = line.trimStart();
      if (
        trimmed.startsWith(fence.char.repeat(fence.len)) &&
        trimmed.replace(new RegExp(`^${fence.char === "`" ? "`" : "~"}+`), "").trim() === ""
      ) {
        fence.block.endLine = lineNo;
        fence.block.closed = true;
        fence = null;
      } else {
        fence.block.lines.push(line);
        fence.block.endLine = lineNo;
      }
      continue;
    }

    // --- opening fence ---
    const fenceMatch = FENCE_OPEN_RE.exec(line);
    if (fenceMatch !== null) {
      const marker = fenceMatch[1] ?? "";
      const info = (fenceMatch[2] ?? "").trim();
      // Backtick fences cannot carry backticks in the info string.
      if (!(marker.startsWith("`") && info.includes("`"))) {
        const lang = (info.split(/\s+/)[0] ?? "")
          .toLowerCase()
          .replace(/^\{\.?/, "")
          .replace(/\}$/, "");
        const block: CodeBlock = {
          lang,
          startLine: lineNo,
          endLine: lineNo,
          lines: [],
          closed: false,
        };
        codeBlocks.push(block);
        fence = { char: marker.charAt(0), len: marker.length, block };
        continue;
      }
    }

    // --- ATX heading ---
    const atx = ATX_RE.exec(line);
    if (atx !== null && (atx[2] ?? "").trim() !== "") {
      const marks = atx[1] ?? "#";
      headings.push({ level: marks.length, text: (atx[2] ?? "").trim(), line: lineNo });
      prose.push({ line: lineNo, text: stripInlineCode((atx[2] ?? "").trim()) });
      wordCount += countWords(stripInlineCode((atx[2] ?? "").trim()));
      continue;
    }

    // --- setext heading (underline on the next line) ---
    const next = i + 1 < lines.length ? at(lines, i + 1) : "";
    if (
      isParagraphish(line) &&
      i + 1 < lines.length &&
      (SETEXT_H1_RE.test(next) || SETEXT_H2_RE.test(next))
    ) {
      const level = SETEXT_H1_RE.test(next) ? 1 : 2;
      headings.push({ level, text: line.trim(), line: lineNo });
      prose.push({ line: lineNo, text: stripInlineCode(line.trim()) });
      wordCount += countWords(stripInlineCode(line.trim()));
      skipNext = true;
      continue;
    }

    // --- reference definition: collect, contributes no prose ---
    const refDef = REF_DEF_RE.exec(line);
    if (refDef !== null) {
      const label = (refDef[1] ?? "").toLowerCase();
      let url = refDef[2] ?? "";
      if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1);
      if (!refDefs.has(label)) refDefs.set(label, url);
      continue;
    }

    // --- ordinary prose line ---
    const scan = stripInlineCode(line);
    let leftover = scan;

    for (const m of scan.matchAll(IMAGE_RE)) {
      const text = m[1] ?? "";
      const url = m[2] ?? "";
      links.push({ text, url, line: lineNo, image: true });
      leftover = leftover.replace(m[0] ?? "", () => ` ${text} `);
    }

    const afterImages = leftover;
    for (const m of afterImages.matchAll(LINK_RE)) {
      const text = m[1] ?? "";
      const url = m[2] ?? "";
      links.push({ text: text.trim(), url, line: lineNo, image: false });
      leftover = leftover.replace(m[0] ?? "", () => ` ${text} `);
    }

    REF_LINK_RE.lastIndex = 0;
    for (const m of leftover.matchAll(REF_LINK_RE)) {
      const image = (m[1] ?? "") === "!";
      const text = m[2] ?? "";
      const label = ((m[3] ?? "") === "" ? text : m[3] ?? "").toLowerCase();
      pendingRefs.push({ image, text, label, line: lineNo });
      leftover = leftover.replace(m[0] ?? "", () => ` ${text} `);
    }

    AUTOLINK_RE.lastIndex = 0;
    for (const m of leftover.matchAll(AUTOLINK_RE)) {
      const url = m[1] ?? "";
      links.push({ text: url, url, line: lineNo, image: false });
      leftover = leftover.replace(m[0] ?? "", " ");
    }

    BARE_URL_RE.lastIndex = 0;
    for (const m of leftover.matchAll(BARE_URL_RE)) {
      bareUrls.push({ url: trimUrlTail(m[0] ?? ""), line: lineNo });
    }
    leftover = leftover.replace(BARE_URL_RE, " ");

    prose.push({ line: lineNo, text: scan });
    wordCount += countWords(leftover);
  }

  // Resolve reference-style links against the collected definitions.
  for (const ref of pendingRefs) {
    const url = refDefs.get(ref.label);
    if (url !== undefined) {
      links.push({ text: ref.text, url, line: ref.line, image: ref.image });
    }
  }
  links.sort((a, b) => a.line - b.line);

  const badges = links.filter((l) => l.image && isBadgeUrl(l.url));
  const sections = buildSections(headings, lines);

  return {
    lines,
    lineCount: lines.length,
    wordCount,
    headings,
    sections,
    codeBlocks,
    links,
    badges,
    bareUrls,
    prose,
    hasFrontMatter: frontMatterEnd > 0,
  };
}

function countWords(text: string): number {
  return text
    .replace(/[*_~#>|`]/g, " ")
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

function buildSections(headings: Heading[], lines: string[]): Section[] {
  const sections: Section[] = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (heading === undefined) continue;
    const nextHeading = headings[i + 1];
    const contentStart = heading.line + 1;
    const contentEnd = nextHeading !== undefined ? nextHeading.line - 1 : lines.length;
    let contentLines = 0;
    for (let ln = contentStart; ln <= contentEnd; ln++) {
      if (at(lines, ln - 1).trim() !== "") contentLines++;
    }
    sections.push({ heading, contentStart, contentEnd, contentLines });
  }
  return sections;
}

/**
 * Last line of a section including its subsections: everything up to the
 * next heading of the same or a shallower level.
 */
export function deepSectionEnd(doc: MarkdownDoc, section: Section): number {
  for (const h of doc.headings) {
    if (h.line > section.heading.line && h.level <= section.heading.level) {
      return h.line - 1;
    }
  }
  return doc.lineCount;
}

/** All code blocks that start inside a section (subsections included). */
export function sectionCodeBlocks(doc: MarkdownDoc, section: Section): CodeBlock[] {
  const end = deepSectionEnd(doc, section);
  return doc.codeBlocks.filter(
    (b) => b.startLine > section.heading.line && b.startLine <= end
  );
}

/** Sections whose heading text matches `re` (any heading level). */
export function findSections(doc: MarkdownDoc, re: RegExp): Section[] {
  return doc.sections.filter((s) => re.test(s.heading.text));
}
