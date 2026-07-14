/**
 * Content (C3xx, 26 points): the substance beyond the bare minimum —
 * tagged code blocks, badges, captured output, prerequisites, a
 * contribution path, something to look at, and reasons to care.
 */

import { findSections, isBadgeUrl } from "./markdown.js";
import {
  CONTRIB_HEADING_RE,
  CONTRIBUTING_FILES,
  FEATURES_HEADING_RE,
  OUTPUT_HINT_RE,
  OUTPUT_LANGS,
  PREREQ_HEADING_RE,
  STANDARD_DOC_LINK_RE,
  clip,
  lineRef,
} from "./heuristics.js";
import type { Check, CheckContext, CheckRun } from "./types.js";

function fenceLanguageTags(ctx: CheckContext): CheckRun {
  const blocks = ctx.doc.codeBlocks;
  if (blocks.length === 0) {
    return { skip: "no fenced code blocks to tag" };
  }
  const untagged = blocks.filter((b) => b.lang === "");
  if (untagged.length === 0) {
    return {
      ratio: 1,
      evidence: [
        blocks.length === 1
          ? "the only fenced block is language-tagged"
          : `all ${blocks.length} fenced blocks are language-tagged`,
      ],
    };
  }
  const ratio = (blocks.length - untagged.length) / blocks.length;
  return {
    ratio,
    evidence: clip(
      untagged.map((b) => `untagged fence at ${lineRef(b.startLine)}`),
      3
    ),
    fix: "Tag every fence (```bash, ```js, ```text) so GitHub highlights it and readers know what they are looking at.",
  };
}

function badges(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  if (doc.badges.length === 0) {
    return {
      ratio: 0,
      evidence: ["no status badges"],
      fix: "Add a license badge and one or two health badges (build, version) under the title.",
    };
  }
  if (doc.badges.length > 10) {
    return {
      ratio: 0.7,
      evidence: [`${doc.badges.length} badges — a badge wall dilutes the signal`],
      fix: "Keep the handful of badges a maintainer actually watches; drop the rest.",
    };
  }
  const firstH2 = doc.headings.find((h) => h.level >= 2);
  const topLimit = Math.max(15, firstH2 === undefined ? 15 : firstH2.line);
  const nearTop = doc.badges.filter((b) => b.line <= topLimit);
  if (nearTop.length > 0) {
    return {
      ratio: 1,
      evidence: [`${doc.badges.length} badge(s) near the top`],
    };
  }
  const first = doc.badges[0];
  return {
    ratio: 0.5,
    evidence: [
      `badges exist (first at ${lineRef(first === undefined ? 1 : first.line)}) but not in the header`,
    ],
    fix: "Move the badge line directly under the title where readers expect it.",
  };
}

function showsOutput(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  if (doc.codeBlocks.length === 0) {
    return { skip: "no code examples to show output for" };
  }
  for (const block of doc.codeBlocks) {
    if (OUTPUT_LANGS.has(block.lang)) {
      return {
        ratio: 1,
        evidence: [`output block (\`\`\`${block.lang}) at ${lineRef(block.startLine)}`],
      };
    }
    const hinted = doc.prose.find(
      (p) =>
        p.line < block.startLine &&
        p.line >= block.startLine - 3 &&
        OUTPUT_HINT_RE.test(p.text)
    );
    if (hinted !== undefined) {
      return {
        ratio: 1,
        evidence: [
          `block at ${lineRef(block.startLine)} is introduced as output (${lineRef(hinted.line)})`,
        ],
      };
    }
  }
  return {
    ratio: 0,
    evidence: ["examples never show what running them produces"],
    fix: "After the main example, add a ```text block with the real captured output.",
  };
}

function prerequisites(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const heading = doc.headings.find((h) => PREREQ_HEADING_RE.test(h.text));
  if (heading !== undefined) {
    return {
      ratio: 1,
      evidence: [`"${heading.text}" section (${lineRef(heading.line)})`],
    };
  }
  const versioned = doc.prose.find((p) =>
    /\b(requires?|needs?|expects|works (with|on)|tested (with|on)|you( wi|')ll need)\b[^.]{0,60}\b(v?\d+(\.\d+)*\+?|\d+\+)/i.test(
      p.text
    )
  );
  if (versioned !== undefined) {
    return {
      ratio: 1,
      evidence: [`runtime requirement stated inline (${lineRef(versioned.line)})`],
    };
  }
  const runtime = doc.prose.find((p) =>
    /\b(node(\.js)?|python|go|rust|java|ruby|php|\.net|docker|postgres(ql)?)\s*(>=|<=|~|\^|v?\d)/i.test(
      p.text
    )
  );
  if (runtime !== undefined) {
    return {
      ratio: 1,
      evidence: [`runtime version mentioned (${lineRef(runtime.line)})`],
    };
  }
  return {
    ratio: 0,
    evidence: ["no prerequisites or supported-version statement"],
    fix: 'State the minimum runtime up front (e.g. "Requires Node.js >= 20") or add a Requirements section.',
  };
}

function contributing(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const heading = doc.headings.find((h) => CONTRIB_HEADING_RE.test(h.text));
  if (heading !== undefined) {
    return {
      ratio: 1,
      evidence: [`"${heading.text}" section (${lineRef(heading.line)})`],
    };
  }
  const link = doc.links.find(
    (l) => !l.image && /contributing(\.md)?(#.*)?$/i.test(l.url)
  );
  if (link !== undefined) {
    return { ratio: 1, evidence: [`CONTRIBUTING link (${lineRef(link.line)})`] };
  }
  if (ctx.projectDir !== null) {
    const file = CONTRIBUTING_FILES.find((f) => ctx.fileExists(f));
    if (file !== undefined) {
      return {
        ratio: 0.5,
        evidence: [`${file} exists but the README never links it`],
        fix: `Add a short "## Contributing" section linking ${file}.`,
      };
    }
  }
  return {
    ratio: 0,
    evidence: ["no contributing section or link"],
    fix: 'Add two sentences under "## Contributing": how to run the tests and where to open issues.',
  };
}

function visualDemo(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const image = doc.links.find((l) => l.image && !isBadgeUrl(l.url));
  if (image !== undefined) {
    return { ratio: 1, evidence: [`image or demo (${lineRef(image.line)})`] };
  }
  const htmlImg = doc.prose.find((p) => /<img\s+[^>]*src=/i.test(p.text));
  if (htmlImg !== undefined) {
    return { ratio: 1, evidence: [`inline <img> (${lineRef(htmlImg.line)})`] };
  }
  return {
    ratio: 0,
    evidence: ["no screenshot, terminal capture or diagram"],
    fix: "Add one screenshot, SVG terminal capture or GIF near the top; it doubles time-on-page.",
  };
}

function featuresOrWhy(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const heading = doc.headings.find((h) => FEATURES_HEADING_RE.test(h.text));
  if (heading !== undefined) {
    return {
      ratio: 1,
      evidence: [`"${heading.text}" section (${lineRef(heading.line)})`],
    };
  }
  const bullets = doc.prose.filter(
    (p) => p.line <= 60 && /^ {0,3}[-*+] \S/.test(p.text)
  );
  if (bullets.length >= 3) {
    const first = bullets[0];
    return {
      ratio: 0.5,
      evidence: [
        `a bullet list near the top (${lineRef(first === undefined ? 1 : first.line)}) may be a feature list`,
      ],
      fix: 'Give that list an explicit "## Features" or "## Why <name>?" heading.',
    };
  }
  return {
    ratio: 0,
    evidence: ["nothing states what makes the project worth using"],
    fix: 'Add a "## Features" bullet list or a short "## Why <name>?" paragraph.',
  };
}

function linksOut(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const docHeading = doc.headings.find((h) =>
    /^(documentation|docs\b|further reading|learn more|resources|api reference)/i.test(h.text)
  );
  if (docHeading !== undefined) {
    return {
      ratio: 1,
      evidence: [`"${docHeading.text}" section (${lineRef(docHeading.line)})`],
    };
  }
  const docLink = doc.links.find((l) => {
    if (l.image || l.url.startsWith("#")) return false;
    if (/^https?:\/\//i.test(l.url)) {
      return /\/(docs?|wiki|documentation)([/#]|$)/i.test(l.url);
    }
    const path = l.url.split("#")[0] ?? "";
    if (!/\.(md|rst|adoc)$/i.test(path)) return /^docs?\//i.test(path);
    return !STANDARD_DOC_LINK_RE.test(path);
  });
  if (docLink !== undefined) {
    return {
      ratio: 1,
      evidence: [`documentation link "${docLink.text}" (${lineRef(docLink.line)})`],
    };
  }
  return {
    ratio: 0,
    evidence: ["no pointers to deeper documentation"],
    fix: "Link at least one deeper resource: docs/, a wiki, a design doc or an examples directory.",
  };
}

export const contentChecks: Check[] = [
  {
    code: "C301",
    name: "fence-language-tags",
    category: "content",
    weight: 4,
    summary: "Every fenced code block declares a language.",
    why: "Untagged fences render as monochrome soup; the tag is one word and buys highlighting plus copy-button semantics.",
    fix: "Tag every fence (```bash, ```js, ```text).",
    run: fenceLanguageTags,
  },
  {
    code: "C302",
    name: "status-badges",
    category: "content",
    weight: 3,
    summary: "One to ten status badges in the header, not a badge wall.",
    why: "A license/build badge answers 'is this maintained and usable?' before a single line is read.",
    fix: "Add a license badge and one or two health badges (build, version) under the title.",
    run: badges,
  },
  {
    code: "C303",
    name: "shows-output",
    category: "content",
    weight: 3,
    summary: "At least one example shows its real captured output.",
    why: "Output is proof; a command without its result forces every reader to install just to see what it does.",
    fix: "After the main example, add a ```text block with the real captured output.",
    run: showsOutput,
  },
  {
    code: "C304",
    name: "prerequisites",
    category: "content",
    weight: 3,
    summary: "Minimum runtime or system requirements are stated.",
    why: "Nothing burns goodwill faster than a failed install that a one-line version requirement would have prevented.",
    fix: 'State the minimum runtime up front (e.g. "Requires Node.js >= 20").',
    run: prerequisites,
  },
  {
    code: "C305",
    name: "contributing",
    category: "content",
    weight: 4,
    summary: "A Contributing section or a link to CONTRIBUTING.md.",
    why: "Would-be contributors leave silently when there is no visible path from reader to participant.",
    fix: 'Add two sentences under "## Contributing": how to run the tests and where to open issues.',
    run: contributing,
  },
  {
    code: "C306",
    name: "visual-demo",
    category: "content",
    weight: 3,
    summary: "A non-badge image: screenshot, terminal capture or diagram.",
    why: "One picture of the tool actually running communicates more than three paragraphs — and proves it runs.",
    fix: "Add one screenshot, SVG terminal capture or GIF near the top.",
    run: visualDemo,
  },
  {
    code: "C307",
    name: "features-or-why",
    category: "content",
    weight: 3,
    summary: "A Features list or a Why section that argues for the project.",
    why: "Readers compare tools; without a stated reason to pick this one, the tab gets closed.",
    fix: 'Add a "## Features" bullet list or a short "## Why <name>?" paragraph.',
    run: featuresOrWhy,
  },
  {
    code: "C308",
    name: "links-out",
    category: "content",
    weight: 3,
    summary: "The README links to deeper documentation somewhere.",
    why: "A README is a front door, not the whole house; dead-ending readers caps how far anyone can get.",
    fix: "Link at least one deeper resource: docs/, a wiki, a design doc or an examples directory.",
    run: linksOut,
  },
];
