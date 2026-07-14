/**
 * Public programmatic API. Everything the CLI does is reachable from here:
 * parse a README, grade it, render reports, and generate score badges.
 *
 *   import { analyze, renderText } from "readmeter";
 *   const report = analyze(readmeSource, { projectDir: "." });
 *   console.log(report.score, report.grade);
 */

export {
  deepSectionEnd,
  findSections,
  isBadgeUrl,
  parseMarkdown,
  sectionCodeBlocks,
  stripInlineCode,
} from "./markdown.js";
export { allCodes, CATEGORY_LABELS, CATEGORY_ORDER, CHECKS, getCheck, TOTAL_WEIGHT } from "./registry.js";
export { analyze, gradeFor, round1, type AnalyzeOptions } from "./score.js";
export {
  fmtPoints,
  renderChecksJson,
  renderChecksTable,
  renderExplain,
  renderJson,
  renderText,
} from "./report.js";
export { badgeColor, badgeMarkdown, badgeUrl, shieldsEscape } from "./badge.js";
export {
  ConfigError,
  CONFIG_FILENAME,
  DEFAULT_CONFIG,
  loadConfig,
  parseConfig,
  validateCodes,
  type Config,
} from "./config.js";
export { HELP_TEXT, parseArgs, UsageError, type ParsedArgs } from "./cliargs.js";
export { VERSION } from "./version.js";
export type {
  CategoryId,
  CategoryScore,
  Check,
  CheckContext,
  CheckResult,
  CheckRun,
  CheckStatus,
  CodeBlock,
  Fix,
  Heading,
  LinkRef,
  MarkdownDoc,
  Report,
  Section,
} from "./types.js";
