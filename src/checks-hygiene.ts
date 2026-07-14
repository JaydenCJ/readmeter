/**
 * Hygiene (H4xx, 16 points): the embarrassment catchers — leftover
 * template placeholders, leaked local filesystem paths, broken relative
 * links, bare URLs and colliding heading anchors.
 */

import { clip, lineRef } from "./heuristics.js";
import type { Check, CheckContext, CheckRun } from "./types.js";

/** Placeholder tokens scanned in prose only (code examples may legitimately
 *  contain angle-bracket placeholders like `<your-api-key>`). */
const PLACEHOLDER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bTODO\b/, label: "TODO" },
  { re: /\bFIXME\b/, label: "FIXME" },
  { re: /\bTBD\b/, label: "TBD" },
  { re: /lorem ipsum/i, label: "lorem ipsum" },
  { re: /coming soon/i, label: "coming soon" },
  { re: /under construction/i, label: "under construction" },
  { re: /\byour-?username\b/i, label: "your-username" },
  { re: /\bchangeme\b/i, label: "changeme" },
  { re: /<insert[^>]*>/i, label: "<insert ...>" },
  { re: /\binsert\s+\w[\w\s]{0,30}\s+here\b/i, label: "insert ... here" },
];

// Home-directory paths on macOS/Linux ("/<home-root>/<name>/") and Windows.
// Built from parts so the checker's own source never contains a literal path.
const UNIX_HOME_RE = new RegExp(
  "(?:^|[^A-Za-z0-9_.-])/(?:home|Users)/[A-Za-z][A-Za-z0-9_.-]*/"
);
const WINDOWS_HOME_RE = /[A-Za-z]:\\Users\\[A-Za-z][A-Za-z0-9_.-]*\\/;

function noPlaceholders(ctx: CheckContext): CheckRun {
  const hits: string[] = [];
  for (const p of ctx.doc.prose) {
    for (const { re, label } of PLACEHOLDER_PATTERNS) {
      if (re.test(p.text)) {
        hits.push(`"${label}" at ${lineRef(p.line)}`);
      }
    }
  }
  if (hits.length === 0) {
    return { ratio: 1, evidence: ["no template placeholders"] };
  }
  return {
    ratio: 0,
    evidence: clip(hits, 5),
    fix: "Finish or delete placeholder text; shipped TODOs read as abandonment.",
  };
}

function noLocalPaths(ctx: CheckContext): CheckRun {
  const hits: string[] = [];
  for (let i = 0; i < ctx.doc.lines.length; i++) {
    const line = ctx.doc.lines[i];
    if (line === undefined) continue;
    if (UNIX_HOME_RE.test(line) || WINDOWS_HOME_RE.test(line)) {
      hits.push(`home-directory path at ${lineRef(i + 1)}`);
    }
  }
  if (hits.length === 0) {
    return { ratio: 1, evidence: ["no leaked local paths"] };
  }
  return {
    ratio: 0,
    evidence: clip(hits, 3),
    fix: "Replace personal home-directory paths with a placeholder like /path/to/project.",
  };
}

function relativeLinksResolve(ctx: CheckContext): CheckRun {
  const rels = ctx.doc.links.filter((l) => {
    if (l.url === "" || l.url.startsWith("#")) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(l.url)) return false; // any scheme
    if (l.url.startsWith("//") || l.url.startsWith("/")) return false; // site-absolute
    return true;
  });
  if (rels.length === 0) {
    return { ratio: 1, evidence: ["no relative links to verify"] };
  }
  if (ctx.projectDir === null) {
    return { skip: "project directory unknown (stdin input); pass --project-dir to enable" };
  }
  const broken = rels.filter((l) => {
    const path = decodeURIComponent((l.url.split("#")[0] ?? "").split("?")[0] ?? "");
    return path !== "" && !ctx.fileExists(path);
  });
  if (broken.length === 0) {
    return { ratio: 1, evidence: [`all ${rels.length} relative link(s) resolve`] };
  }
  return {
    ratio: (rels.length - broken.length) / rels.length,
    evidence: clip(
      broken.map((l) => `broken link "${l.url}" at ${lineRef(l.line)}`),
      5
    ),
    fix: "Fix or remove relative links that point at files missing from the repository.",
  };
}

function noBareUrls(ctx: CheckContext): CheckRun {
  const bare = ctx.doc.bareUrls;
  if (bare.length === 0) {
    return { ratio: 1, evidence: ["no bare URLs in prose"] };
  }
  const evidence = clip(
    bare.map((b) => `bare URL at ${lineRef(b.line)}`),
    3
  );
  return {
    ratio: bare.length < 5 ? 0.5 : 0,
    evidence,
    fix: "Wrap raw URLs in Markdown links: [descriptive text](url).",
  };
}

function uniqueHeadings(ctx: CheckContext): CheckRun {
  const seen = new Map<string, number[]>();
  for (const h of ctx.doc.headings) {
    const key = h.text.trim().toLowerCase();
    const list = seen.get(key);
    if (list === undefined) seen.set(key, [h.line]);
    else list.push(h.line);
  }
  const dups = [...seen.entries()].filter(([, lines]) => lines.length > 1);
  if (dups.length === 0) {
    return { ratio: 1, evidence: ["all heading texts are unique"] };
  }
  return {
    ratio: dups.length === 1 ? 0.5 : 0,
    evidence: clip(
      dups.map(([text, lines]) => `"${text}" repeats (lines ${lines.join(", ")})`),
      3
    ),
    fix: "Rename duplicate headings; identical texts collide in anchor links and TOCs.",
  };
}

export const hygieneChecks: Check[] = [
  {
    code: "H401",
    name: "no-placeholders",
    category: "hygiene",
    weight: 4,
    summary: "No TODO/FIXME/lorem-ipsum/template placeholders in prose.",
    why: "A single visible TODO tells readers the document was never finished — and makes them wonder about the code.",
    fix: "Finish or delete placeholder text; shipped TODOs read as abandonment.",
    run: noPlaceholders,
  },
  {
    code: "H402",
    name: "no-local-paths",
    category: "hygiene",
    weight: 3,
    summary: "No personal home-directory paths leaked anywhere in the file.",
    why: "Home-directory paths leak usernames, break copy-paste for everyone else, and flag copy-pasted terminal dumps.",
    fix: "Replace personal home-directory paths with a placeholder like /path/to/project.",
    run: noLocalPaths,
  },
  {
    code: "H403",
    name: "relative-links-resolve",
    category: "hygiene",
    weight: 4,
    summary: "Every relative link and image points at a file that exists.",
    why: "A broken LICENSE or docs link is the most common silent rot in shipped READMEs.",
    fix: "Fix or remove relative links that point at files missing from the repository.",
    run: relativeLinksResolve,
  },
  {
    code: "H404",
    name: "no-bare-urls",
    category: "hygiene",
    weight: 2,
    summary: "Prose URLs are wrapped in Markdown links.",
    why: "Bare URLs are unreadable, unclickable in some renderers, and say nothing about their target.",
    fix: "Wrap raw URLs in Markdown links: [descriptive text](url).",
    run: noBareUrls,
  },
  {
    code: "H405",
    name: "unique-headings",
    category: "hygiene",
    weight: 3,
    summary: "No two headings share the same text.",
    why: "GitHub derives anchors from heading text; duplicates make half the deep links land in the wrong place.",
    fix: "Rename duplicate headings; identical texts collide in anchor links and TOCs.",
    run: uniqueHeadings,
  },
];
