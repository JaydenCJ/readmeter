/**
 * The check registry: the single ordered list of every check, plus lookup
 * helpers. Codes are stable API — a code is never renumbered or reused, and
 * the registry invariants (unique codes, weights summing to exactly 100)
 * are asserted by the test suite.
 */

import { contentChecks } from "./checks-content.js";
import { essentialChecks } from "./checks-essentials.js";
import { hygieneChecks } from "./checks-hygiene.js";
import { structureChecks } from "./checks-structure.js";
import type { CategoryId, Check } from "./types.js";

/** All checks in report order: essentials, structure, content, hygiene. */
export const CHECKS: readonly Check[] = [
  ...essentialChecks,
  ...structureChecks,
  ...contentChecks,
  ...hygieneChecks,
];

export const CATEGORY_ORDER: readonly CategoryId[] = [
  "essentials",
  "structure",
  "content",
  "hygiene",
];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  essentials: "Essentials",
  structure: "Structure",
  content: "Content",
  hygiene: "Hygiene",
};

/** Total weight across all checks. Always exactly 100. */
export const TOTAL_WEIGHT: number = CHECKS.reduce((sum, c) => sum + c.weight, 0);

/** Look up a check by its code, case-insensitively. */
export function getCheck(code: string): Check | undefined {
  const wanted = code.toUpperCase();
  return CHECKS.find((c) => c.code === wanted);
}

/** All valid codes, in report order. */
export function allCodes(): string[] {
  return CHECKS.map((c) => c.code);
}
