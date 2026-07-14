/**
 * Offline shields.io badge generation: given a score, produce the static
 * badge URL or ready-to-paste Markdown. Nothing is fetched — the URL is a
 * plain string for the reader's renderer to resolve.
 */

/** shields.io static-badge escaping: dash, underscore and space are special. */
export function shieldsEscape(text: string): string {
  return encodeURIComponent(text.replace(/-/g, "--").replace(/_/g, "__").replace(/ /g, "_"));
}

/** Badge color for a score, matching the letter-grade bands. */
export function badgeColor(score: number): string {
  if (score >= 90) return "brightgreen";
  if (score >= 80) return "green";
  if (score >= 70) return "yellow";
  if (score >= 60) return "orange";
  return "red";
}

/** Static shields.io URL for a score badge. */
export function badgeUrl(score: number, label = "readme score"): string {
  const message = `${score}/100`;
  return `https://img.shields.io/badge/${shieldsEscape(label)}-${shieldsEscape(
    message
  )}-${badgeColor(score)}`;
}

/** Ready-to-paste Markdown image for a score badge. */
export function badgeMarkdown(score: number, label = "readme score"): string {
  return `![${label}](${badgeUrl(score, label)})`;
}
