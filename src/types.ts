/**
 * Core shared types: the parsed Markdown document model, check metadata,
 * per-check results and the final report. Everything downstream (score,
 * report, badge, CLI) is defined in terms of these shapes.
 */

export type CategoryId = "essentials" | "structure" | "content" | "hygiene";

export type CheckStatus = "pass" | "partial" | "fail" | "skip";

/** An ATX (`## Title`) or setext (underlined) heading. */
export interface Heading {
  /** 1 (H1) .. 6 (H6). */
  level: number;
  /** Heading text with surrounding markup trimmed. */
  text: string;
  /** 1-based line number of the heading text. */
  line: number;
}

/** A fenced code block (``` or ~~~). */
export interface CodeBlock {
  /** First word of the info string, lowercased; "" when untagged. */
  lang: string;
  /** 1-based line of the opening fence. */
  startLine: number;
  /** 1-based line of the closing fence (last line of the file if unclosed). */
  endLine: number;
  /** Content lines between the fences. */
  lines: string[];
  /** False when the closing fence is missing. */
  closed: boolean;
}

/** A Markdown link or image (inline, reference-style or autolink). */
export interface LinkRef {
  text: string;
  url: string;
  line: number;
  image: boolean;
}

/** A heading plus the flat run of lines that follows it. */
export interface Section {
  heading: Heading;
  /** 1-based first line after the heading. */
  contentStart: number;
  /** 1-based last line before the next heading of any level (inclusive). */
  contentEnd: number;
  /** Number of non-blank lines in the section's own flat segment. */
  contentLines: number;
}

/** The parsed document model every check runs against. */
export interface MarkdownDoc {
  /** Raw lines (CR stripped); line N of the file is lines[N - 1]. */
  lines: string[];
  lineCount: number;
  /** Approximate prose word count (headings included, code and URLs excluded). */
  wordCount: number;
  headings: Heading[];
  sections: Section[];
  codeBlocks: CodeBlock[];
  links: LinkRef[];
  /** Subset of links: images whose URL looks like a status badge. */
  badges: LinkRef[];
  /** Raw http(s) URLs in prose that are not wrapped in a link or autolink. */
  bareUrls: { url: string; line: number }[];
  /** Lines outside code fences and front matter, with inline code blanked. */
  prose: { line: number; text: string }[];
  /** True when the file starts with a YAML front matter block. */
  hasFrontMatter: boolean;
}

/** Everything a check may look at. Checks never touch the filesystem directly. */
export interface CheckContext {
  doc: MarkdownDoc;
  /** README path as given on the command line; null when reading stdin. */
  filePath: string | null;
  /**
   * Directory used to resolve relative links and detect sibling files
   * (LICENSE, CONTRIBUTING.md); null when unknown.
   */
  projectDir: string | null;
  /** Existence probe for a path relative to projectDir. Injected for testability. */
  fileExists: (relPath: string) => boolean;
}

/** What a check's run() returns: a graded result, or a reason it does not apply. */
export type CheckRun =
  | { ratio: number; evidence: string[]; fix?: string }
  | { skip: string };

export interface Check {
  /** Stable code, e.g. "E103". Codes never change meaning across versions. */
  code: string;
  /** Short kebab-case name, e.g. "install-steps". */
  name: string;
  category: CategoryId;
  /** Points this check contributes to the 100-point total. */
  weight: number;
  /** One-line description of what passes. */
  summary: string;
  /** Why the check matters (shown by `readmeter explain`). */
  why: string;
  /** Generic remediation advice (a run may return a more specific fix). */
  fix: string;
  run: (ctx: CheckContext) => CheckRun;
}

export interface CheckResult {
  code: string;
  name: string;
  category: CategoryId;
  weight: number;
  status: CheckStatus;
  /** Fraction of the weight earned, 0..1 (0 for skip). */
  ratio: number;
  /** Points earned (weight * ratio; 0 for skip). */
  earned: number;
  evidence: string[];
  /** Concrete remediation; null when the check passed or was skipped. */
  fix: string | null;
  /** Reason the check did not apply; null unless status is "skip". */
  skipReason: string | null;
}

export interface CategoryScore {
  category: CategoryId;
  earned: number;
  /** Total weight of this category's applicable (non-skipped) checks. */
  applicable: number;
}

/** One prioritized remediation entry, ordered by recoverable points. */
export interface Fix {
  code: string;
  name: string;
  /** Points recoverable by fixing this check. */
  points: number;
  advice: string;
}

export interface Report {
  file: string;
  /** 0..100 integer: 100 * earned / applicable, rounded half-up. */
  score: number;
  /** A (>=90) / B (>=80) / C (>=70) / D (>=60) / F. */
  grade: string;
  earned: number;
  applicable: number;
  results: CheckResult[];
  categories: CategoryScore[];
  fixes: Fix[];
  /** Codes excluded via config or --disable, sorted. */
  disabled: string[];
}
