/**
 * Shared heading and command heuristics used by more than one check. Kept
 * in one place so the checklist, its tests and docs/checks.md cannot drift
 * apart. Every regex here is part of the documented rule behavior.
 */

export const INSTALL_HEADING_RE =
  /^(installation|install(ing)?|setup|set[- ]?up|getting started|quick ?start)\b/i;

export const USAGE_HEADING_RE =
  /^(usage|using\b|quick ?start|getting started|examples?\b|how to use|basic usage|tutorial|demo\b)/i;

export const LICENSE_HEADING_RE = /licen[cs]e/i;

export const CONTRIB_HEADING_RE = /contribut/i;

export const PREREQ_HEADING_RE =
  /^(prerequisites?|requirements?|dependencies|system requirements|before you (begin|start)|supported (platforms|versions))\b/i;

export const FEATURES_HEADING_RE =
  /^(features|key features|highlights|why\b|motivation|what (is|does) )/i;

export const TOC_HEADING_RE = /^(table of contents|contents|toc)\b/i;

export const OUTPUT_HINT_RE =
  /\b(outputs?|prints?|results?|returns|you (should |will )?see|produces|expected|shows)\b/i;

/** Package-manager / fetch commands that make an install block copy-pasteable. */
export const INSTALL_CMD_RE =
  /(^|[\s;&|(])(npm (i|ci|install)|npx |yarn (add|install|dlx)|pnpm (add|install)|pip3? install|pipx install|uv (pip install|tool install|add)|cargo (install|add|build)|go (install|get)|gem install|bundle (add|install)|composer (require|install)|brew (install|tap)|apt(-get)? install|dnf install|pacman -S|nix (profile install|run)|docker (pull|run|compose)|git clone|make install)\b/;

/**
 * Shell lines that set up an environment rather than demonstrate the tool.
 * Used to tell an install snippet apart from a usage example.
 */
export const SETUP_LINE_RE =
  /^\s*\$?\s*(cd|mkdir|cp|mv|curl|wget|tar|unzip|chmod|chown|ln|sudo|source|export|set)\b/;

/** Languages whose fenced blocks typically show captured output, not input. */
export const OUTPUT_LANGS = new Set([
  "text",
  "txt",
  "console",
  "output",
  "shell-session",
  "log",
  "ansi",
]);

/** Case-insensitive filenames commonly used for the four standard docs. */
export const LICENSE_FILES = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "LICENCE",
  "LICENCE.md",
  "COPYING",
];

export const CONTRIBUTING_FILES = ["CONTRIBUTING.md", "CONTRIBUTING", ".github/CONTRIBUTING.md"];

/** Standard repo files whose links do not count as "further documentation". */
export const STANDARD_DOC_LINK_RE =
  /(^|\/)(readme|license|licence|contributing|changelog|code[-_]of[-_]conduct|security)(\.[a-z]+)?$/i;

/** Format a 1-based line reference for evidence strings. */
export function lineRef(line: number): string {
  return `line ${line}`;
}

/** Clip an evidence list to `max` entries, appending an "and N more" tail. */
export function clip(items: string[], max: number): string[] {
  if (items.length <= max) return items;
  const kept = items.slice(0, max);
  kept.push(`... and ${items.length - max} more`);
  return kept;
}
