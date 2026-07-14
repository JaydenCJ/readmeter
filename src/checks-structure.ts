/**
 * Structure (S2xx, 15 points): the skeleton of the document — heading
 * hierarchy, navigability, healthy length, and whether the hands-on part
 * appears before the reader gives up scrolling.
 */

import { findSections } from "./markdown.js";
import {
  INSTALL_HEADING_RE,
  TOC_HEADING_RE,
  USAGE_HEADING_RE,
  clip,
  lineRef,
} from "./heuristics.js";
import type { Check, CheckContext, CheckRun } from "./types.js";

function headingHierarchy(ctx: CheckContext): CheckRun {
  const { headings } = ctx.doc;
  if (headings.length === 0) {
    return {
      ratio: 0,
      evidence: ["no headings at all — the document has no navigable structure"],
      fix: "Break the README into sections with `##` headings (Install, Usage, License, ...).",
    };
  }
  const violations: string[] = [];
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const cur = headings[i];
    if (prev === undefined || cur === undefined) continue;
    if (cur.level > prev.level + 1) {
      violations.push(
        `h${prev.level} -> h${cur.level} jump at ${lineRef(cur.line)} ("${cur.text}")`
      );
    }
  }
  if (violations.length === 0) {
    return {
      ratio: 1,
      evidence: [
        headings.length === 1
          ? "1 heading, no skipped levels"
          : `${headings.length} headings, no skipped levels`,
      ],
    };
  }
  return {
    ratio: 0.3,
    evidence: clip(violations, 3),
    fix: "Never skip heading levels; an h2 section nests h3 subsections, not h4.",
  };
}

function tocWhenLong(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  if (doc.lineCount < 120) {
    return {
      ratio: 1,
      evidence: [`short README (${doc.lineCount} lines) — a TOC is not required`],
    };
  }
  const tocHeading = doc.headings.find((h) => TOC_HEADING_RE.test(h.text));
  if (tocHeading !== undefined) {
    return { ratio: 1, evidence: [`table of contents (${lineRef(tocHeading.line)})`] };
  }
  const anchors = doc.links.filter((l) => !l.image && l.url.startsWith("#") && l.line <= 80);
  if (anchors.length >= 3) {
    const first = anchors[0];
    return {
      ratio: 1,
      evidence: [
        `${anchors.length} anchor links near the top (first at ${lineRef(
          first === undefined ? 1 : first.line
        )}) act as a TOC`,
      ],
    };
  }
  return {
    ratio: 0,
    evidence: [`${doc.lineCount} lines with no table of contents`],
    fix: "Add a short TOC of anchor links after the intro so readers can jump to Install/Usage.",
  };
}

function healthyLength(ctx: CheckContext): CheckRun {
  const w = ctx.doc.wordCount;
  if (w < 50) {
    return {
      ratio: 0,
      evidence: [`only ${w} words of prose — too thin to evaluate or trust`],
      fix: "Explain what the project does, how to install it and how to use it; aim for 120+ words.",
    };
  }
  if (w < 120) {
    return {
      ratio: 0.5,
      evidence: [`${w} words of prose — bare minimum, likely missing context`],
      fix: "Flesh out the why and the quickstart; aim for 120+ words of prose.",
    };
  }
  if (w < 4000) {
    return { ratio: 1, evidence: [`${w} words of prose — healthy range`] };
  }
  if (w < 8000) {
    return {
      ratio: 0.7,
      evidence: [`${w} words — heavyweight; deep reference material belongs in docs/`],
      fix: "Move exhaustive reference sections into docs/ and link them from the README.",
    };
  }
  return {
    ratio: 0.4,
    evidence: [`${w} words — a manual, not a README`],
    fix: "Keep the README to overview + quickstart; move the rest into docs/.",
  };
}

function quickstartEarly(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const candidates = [
    ...findSections(doc, INSTALL_HEADING_RE),
    ...findSections(doc, USAGE_HEADING_RE),
  ].sort((a, b) => a.heading.line - b.heading.line);
  const first = candidates[0];
  if (first === undefined) {
    return { skip: "no install or usage section to position (see E103/E104)" };
  }
  const threshold = Math.max(80, Math.ceil(doc.lineCount * 0.5));
  if (first.heading.line <= threshold) {
    return {
      ratio: 1,
      evidence: [
        `hands-on content starts at ${lineRef(first.heading.line)} of ${doc.lineCount}`,
      ],
    };
  }
  return {
    ratio: 0.4,
    evidence: [
      `first hands-on section ("${first.heading.text}") starts at ${lineRef(
        first.heading.line
      )} of ${doc.lineCount}`,
    ],
    fix: "Move Install/Quickstart above long background sections; readers scroll for commands first.",
  };
}

function noEmptySections(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  if (doc.sections.length === 0) {
    return { skip: "no sections to inspect (see S201)" };
  }
  const empty: string[] = [];
  for (let i = 0; i < doc.sections.length; i++) {
    const s = doc.sections[i];
    if (s === undefined || s.contentLines > 0) continue;
    const next = doc.sections[i + 1];
    // A heading followed directly by a deeper heading is a parent, not empty.
    if (next !== undefined && next.heading.level > s.heading.level) continue;
    empty.push(`"${s.heading.text}" (${lineRef(s.heading.line)})`);
  }
  if (empty.length === 0) {
    return { ratio: 1, evidence: ["every section has content"] };
  }
  return {
    ratio: empty.length === 1 ? 0.5 : 0,
    evidence: clip(empty.map((e) => `empty section ${e}`), 3),
    fix: "Fill or delete empty sections; a bare heading reads as an abandoned draft.",
  };
}

export const structureChecks: Check[] = [
  {
    code: "S201",
    name: "heading-hierarchy",
    category: "structure",
    weight: 3,
    summary: "Headings never skip levels (no h2 -> h4 jumps).",
    why: "Outlines, GitHub's TOC widget and screen readers all derive structure from levels; skips scramble them.",
    fix: "Never skip heading levels; an h2 section nests h3 subsections, not h4.",
    run: headingHierarchy,
  },
  {
    code: "S202",
    name: "toc-when-long",
    category: "structure",
    weight: 3,
    summary: "READMEs of 120+ lines offer a table of contents or anchor links.",
    why: "Past two screens of content, readers navigate by jumping; without a TOC they leave instead.",
    fix: "Add a short TOC of anchor links after the intro so readers can jump to Install/Usage.",
    run: tocWhenLong,
  },
  {
    code: "S203",
    name: "healthy-length",
    category: "structure",
    weight: 3,
    summary: "Prose length in the healthy 120-4000 word band.",
    why: "Under ~120 words there is nothing to evaluate; past ~4000 the quickstart drowns in reference material.",
    fix: "Aim for 120+ words; move exhaustive reference sections into docs/.",
    run: healthyLength,
  },
  {
    code: "S204",
    name: "quickstart-early",
    category: "structure",
    weight: 3,
    summary: "Install/usage content starts in the first half of the document.",
    why: "Most visitors scroll only until they find a command to paste; hands-on content buried below the fold never gets run.",
    fix: "Move Install/Quickstart above long background sections.",
    run: quickstartEarly,
  },
  {
    code: "S205",
    name: "no-empty-sections",
    category: "structure",
    weight: 3,
    summary: "No heading sits directly on the next heading with zero content.",
    why: "Empty sections signal an abandoned template and erode trust in everything around them.",
    fix: "Fill or delete empty sections; a bare heading reads as an abandoned draft.",
    run: noEmptySections,
  },
];
