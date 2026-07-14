/**
 * Essentials (E1xx, 43 points): the five things a first-time visitor needs
 * before anything else — what the project is called, what it does, how to
 * install it, how to use it, and under which terms.
 */

import { findSections, sectionCodeBlocks } from "./markdown.js";
import {
  INSTALL_CMD_RE,
  INSTALL_HEADING_RE,
  LICENSE_FILES,
  LICENSE_HEADING_RE,
  SETUP_LINE_RE,
  USAGE_HEADING_RE,
  clip,
  lineRef,
} from "./heuristics.js";
import type { Check, CheckContext, CheckRun, CodeBlock } from "./types.js";

/** True when a code block only sets up an environment (clone, cd, install). */
function isSetupOnlyBlock(block: CodeBlock): boolean {
  const meaningful = block.lines.filter((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  if (meaningful.length === 0) return false;
  return meaningful.every((l) => INSTALL_CMD_RE.test(l) || SETUP_LINE_RE.test(l));
}

function projectTitle(ctx: CheckContext): CheckRun {
  const h1s = ctx.doc.headings.filter((h) => h.level === 1);
  const first = ctx.doc.headings[0];
  if (h1s.length === 0) {
    return {
      ratio: 0,
      evidence: ["no H1 heading found"],
      fix: "Start the README with `# <project-name>` on the first line.",
    };
  }
  if (h1s.length > 1) {
    const lines = h1s.map((h) => h.line).join(", ");
    return {
      ratio: 0.4,
      evidence: [`${h1s.length} H1 headings (lines ${lines}); anchors and outlines break`],
      fix: "Keep a single H1 for the project name; demote the others to `##`.",
    };
  }
  const h1 = h1s[0];
  if (h1 === undefined) return { skip: "unreachable" };
  if (first !== undefined && first.line === h1.line && h1.line <= 15) {
    return { ratio: 1, evidence: [`single H1 "${h1.text}" (${lineRef(h1.line)})`] };
  }
  return {
    ratio: 0.6,
    evidence: [`H1 "${h1.text}" is buried (${lineRef(h1.line)}) or preceded by other headings`],
    fix: "Move the `# <project-name>` heading to the top of the file.",
  };
}

function oneLineDescription(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const title = doc.headings.find((h) => h.level === 1) ?? doc.headings[0];
  const from = title !== undefined ? title.line + 1 : 1;
  const firstBelow = doc.headings.find((h) => h.line >= from);
  const to = firstBelow !== undefined ? firstBelow.line - 1 : Math.min(doc.lineCount, from + 15);

  const isDescription = (text: string): boolean => {
    let t = text.trim();
    if (t.startsWith(">")) t = t.slice(1).trim(); // blockquote taglines count
    t = t
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images contribute nothing
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // keep link text
      .replace(/[*_]/g, "")
      .trim();
    if (t === "" || t.startsWith("#") || t.startsWith("|") || t.startsWith("---")) return false;
    return t.length >= 20;
  };

  for (const p of doc.prose) {
    if (p.line < from || p.line > to) continue;
    if (isDescription(p.text)) {
      return { ratio: 1, evidence: [`description found (${lineRef(p.line)})`] };
    }
  }
  for (const p of doc.prose) {
    if (p.line <= to || p.line > 40) continue;
    if (isDescription(p.text)) {
      return {
        ratio: 0.4,
        evidence: [`first real description is buried (${lineRef(p.line)})`],
        fix: "Move a one-or-two-sentence summary directly under the title.",
      };
    }
  }
  return {
    ratio: 0,
    evidence: ["no descriptive sentence near the top"],
    fix: "Add one bold sentence under the title saying what the project does and for whom.",
  };
}

function installSteps(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const sections = findSections(doc, INSTALL_HEADING_RE);
  const cmdBlocks = doc.codeBlocks.filter((b) => b.lines.some((l) => INSTALL_CMD_RE.test(l)));

  if (sections.length > 0) {
    const withCmd = sections.find((s) =>
      sectionCodeBlocks(doc, s).some((b) => b.lines.some((l) => INSTALL_CMD_RE.test(l)))
    );
    if (withCmd !== undefined) {
      return {
        ratio: 1,
        evidence: [
          `"${withCmd.heading.text}" section (${lineRef(withCmd.heading.line)}) has a runnable command`,
        ],
      };
    }
    const withCode = sections.find((s) => sectionCodeBlocks(doc, s).length > 0);
    if (withCode !== undefined) {
      return {
        ratio: 0.7,
        evidence: [
          `"${withCode.heading.text}" section has a code block but no recognized package-manager command`,
        ],
        fix: "Make the install block copy-pasteable (e.g. `npm install <pkg>` or `git clone` + build steps).",
      };
    }
    const s = sections[0];
    return {
      ratio: 0.4,
      evidence: [
        `"${s === undefined ? "Install" : s.heading.text}" section has no code block at all`,
      ],
      fix: "Add a fenced code block with the exact install command to the install section.",
    };
  }
  const cmd = cmdBlocks[0];
  if (cmd !== undefined) {
    return {
      ratio: 0.5,
      evidence: [`install command found (${lineRef(cmd.startLine)}) but under no Install heading`],
      fix: 'Group the command under an explicit "## Install" heading so scanners and readers can find it.',
    };
  }
  return {
    ratio: 0,
    evidence: ["no install section and no install command anywhere"],
    fix: 'Add an "## Install" section with one copy-pasteable command per supported method.',
  };
}

function usageExample(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const sections = findSections(doc, USAGE_HEADING_RE);
  const withCode = sections.find((s) => sectionCodeBlocks(doc, s).length > 0);
  if (withCode !== undefined) {
    return {
      ratio: 1,
      evidence: [
        `"${withCode.heading.text}" section (${lineRef(withCode.heading.line)}) has a code example`,
      ],
    };
  }
  if (sections.length > 0) {
    const s = sections[0];
    return {
      ratio: 0.4,
      evidence: [
        `"${s === undefined ? "Usage" : s.heading.text}" section exists but contains no code example`,
      ],
      fix: "Show at least one fenced code block with a minimal, real invocation.",
    };
  }
  const demo = doc.codeBlocks.find((b) => !isSetupOnlyBlock(b) && b.lines.length > 0);
  if (demo !== undefined) {
    return {
      ratio: 0.5,
      evidence: [`code example found (${lineRef(demo.startLine)}) but under no Usage heading`],
      fix: 'Put the example under a "## Usage" or "## Quickstart" heading.',
    };
  }
  return {
    ratio: 0,
    evidence: ["no usage example anywhere"],
    fix: 'Add a "## Usage" section with the smallest command or code snippet that does something real.',
  };
}

function licenseCheck(ctx: CheckContext): CheckRun {
  const { doc } = ctx;
  const heading = doc.headings.find((h) => LICENSE_HEADING_RE.test(h.text));
  const licenseLink = doc.links.find(
    (l) => !l.image && /(^|\/)(un)?licen[cs]e(\.(md|txt))?(#.*)?$/i.test(l.url)
  );
  const named = doc.prose.find((p) =>
    /\b(MIT|Apache[- ]2\.0|GPL(v[23])?|[AL]GPL|BSD[- ]?[23]|MPL[- ]?2\.0|ISC|Unlicense|CC0)\b.{0,40}\blicen[cs]e|licen[cs]ed under\b|released under\b/i.test(
      p.text
    )
  );

  if (heading !== undefined) {
    const section = doc.sections.find((s) => s.heading.line === heading.line);
    if (section !== undefined && section.contentLines === 0) {
      return {
        ratio: 0.7,
        evidence: [`"${heading.text}" heading (${lineRef(heading.line)}) has no content`],
        fix: "State the license name and link the LICENSE file under the heading.",
      };
    }
    return { ratio: 1, evidence: [`"${heading.text}" section (${lineRef(heading.line)})`] };
  }
  if (licenseLink !== undefined || named !== undefined) {
    const line = licenseLink !== undefined ? licenseLink.line : named === undefined ? 1 : named.line;
    return {
      ratio: 0.7,
      evidence: [`license mentioned (${lineRef(line)}) but there is no License section`],
      fix: 'Add a short "## License" section; one line naming the license is enough.',
    };
  }
  if (ctx.projectDir !== null) {
    const file = LICENSE_FILES.find((f) => ctx.fileExists(f));
    if (file !== undefined) {
      return {
        ratio: 0.4,
        evidence: [`${file} exists in the project but the README never mentions it`],
        fix: `Add "## License" with a link to ${file}.`,
      };
    }
  }
  return {
    ratio: 0,
    evidence: clip(["no license section, link or mention"], 3),
    fix: 'Pick a license, commit it as LICENSE, and add a "## License" section linking it.',
  };
}

export const essentialChecks: Check[] = [
  {
    code: "E101",
    name: "project-title",
    category: "essentials",
    weight: 8,
    summary: "Exactly one H1 with the project name, at the top of the file.",
    why: "The H1 names the page in search results, anchors and screen readers; multiple or missing H1s make the project literally unidentifiable.",
    fix: "Start the README with `# <project-name>` on the first line.",
    run: projectTitle,
  },
  {
    code: "E102",
    name: "one-line-description",
    category: "essentials",
    weight: 6,
    summary: "A real sentence directly under the title saying what the project does.",
    why: "Visitors decide in seconds; a tagline under the title is the one line almost everyone reads.",
    fix: "Add one bold sentence under the title saying what the project does and for whom.",
    run: oneLineDescription,
  },
  {
    code: "E103",
    name: "install-steps",
    category: "essentials",
    weight: 10,
    summary: "An install section whose code block contains a copy-pasteable command.",
    why: "Missing install steps are the single most common reason people bounce off new projects.",
    fix: 'Add an "## Install" section with one copy-pasteable command per supported method.',
    run: installSteps,
  },
  {
    code: "E104",
    name: "usage-example",
    category: "essentials",
    weight: 10,
    summary: "A usage/quickstart section with at least one real code example.",
    why: "An example is the fastest proof the tool does what the tagline claims and shows the API surface at a glance.",
    fix: 'Add a "## Usage" section with the smallest command or code snippet that does something real.',
    run: usageExample,
  },
  {
    code: "E105",
    name: "license-stated",
    category: "essentials",
    weight: 9,
    summary: "A License section, or at least a clear license mention or link.",
    why: "No stated license means legally unusable at most companies — a silent adoption killer.",
    fix: 'Pick a license, commit it as LICENSE, and add a "## License" section linking it.',
    run: licenseCheck,
  },
];
