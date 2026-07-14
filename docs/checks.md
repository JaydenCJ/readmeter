# The readmeter checklist

Every check has a stable code, a weight (its share of the 100-point total)
and documented partial-credit tiers. Codes are stable API: a code is never
renumbered or given a new meaning; new checks get new codes. `readmeter
checks` prints the live table; `readmeter explain <code>` prints one rule.

Scoring mechanics (ratios, skips, grades) are described in
[scoring.md](scoring.md).

## Essentials — E1xx (43 points)

The five things a first-time visitor needs: name, purpose, install, usage,
license. They carry almost half the score on purpose.

### E101 project-title (8)

Passes when the document has exactly one H1, it is the first heading, and
it appears within the first 15 lines. Tiers: one H1 that is buried or
preceded by other headings earns 0.6; multiple H1s earn 0.4 (anchors and
outlines break); no H1 earns 0. Setext (`===` underline) titles count.

### E102 one-line-description (6)

Passes when a real sentence (at least 20 characters after markup is
stripped) sits between the title and the first section heading. Blockquote
taglines and bold sentences count; badge lines and images do not. A
description that only appears after the first section earns 0.4.

### E103 install-steps (10)

Passes when an install-family section (`Install`, `Installation`, `Setup`,
`Getting started`, `Quickstart`) contains a fenced code block with a
recognized package-manager or fetch command (`npm install`, `pip install`,
`cargo install`, `go install`, `brew install`, `docker run`, `git clone`,
`make install`, and friends — subsections count). Tiers: a code block with
no recognized command earns 0.7 (building from source is fine); an install
section with no code at all earns 0.4; a recognized command under no
install heading earns 0.5; nothing earns 0.

### E104 usage-example (10)

Passes when a usage-family section (`Usage`, `Examples`, `Quickstart`,
`How to use`, `Demo`) contains a code example. A usage section without
code earns 0.4. A demo block outside any usage section earns 0.5 — unless
every line of it is setup (clone/cd/install), which does not count as
showing usage.

### E105 license-stated (9)

Passes with a `License` section that has content. An empty license heading
earns 0.7; a license link or a "released under the MIT license" style
mention without a section earns 0.7; a LICENSE file that exists in the
project but is never mentioned earns 0.4; nothing earns 0.

## Structure — S2xx (15 points)

### S201 heading-hierarchy (3)

Passes when no heading is more than one level deeper than the one before
it. Any h2 -> h4 style jump drops the check to 0.3 with each jump listed.
A document with no headings at all earns 0.

### S202 toc-when-long (3)

Documents under 120 lines pass automatically — a TOC there is noise. At
120+ lines the check wants a `Table of contents` heading or at least three
`#anchor` links in the first 80 lines.

### S203 healthy-length (3)

Counts prose words (headings included; code blocks, URLs and front matter
excluded). Bands: under 50 words earns 0; 50–119 earns 0.5; 120–3999
passes; 4000–7999 earns 0.7; 8000+ earns 0.4 (that is a manual, not a
README).

### S204 quickstart-early (3)

Passes when the first install/usage heading starts within the first half
of the document (or the first 80 lines, whichever is larger). A hands-on
section buried below the fold earns 0.4. Skips when there is no install or
usage section at all — E103/E104 already charge for that.

### S205 no-empty-sections (3)

A section is empty when its heading sits directly on the next heading of
the same or shallower level with no content between. Parents of
subsections are not empty. One empty section earns 0.5; two or more earn
0. Skips when the document has no sections (S201 charges for that).

## Content — C3xx (26 points)

### C301 fence-language-tags (4)

Score is the fraction of fenced code blocks that declare a language
(````bash`, ````js`, ````text`). Skips when there are no fenced blocks.

### C302 status-badges (3)

Passes with 1–10 badges near the top (above or at the first section
heading). Badges buried mid-document earn 0.5; more than 10 is a badge
wall and earns 0.7; none earns 0. Badge detection covers shields.io,
badgen, codecov, coveralls and `badge.svg` workflow images.

### C303 shows-output (3)

Passes when at least one block is captured output: a fence tagged `text`,
`console`, `output`, `shell-session` or `log`, or any block introduced
within three lines by prose like "Output:", "prints", "you should see".
Skips when the README has no code blocks.

### C304 prerequisites (3)

Passes with a requirements-family heading (`Prerequisites`,
`Requirements`, `Dependencies`, `Supported platforms`) or an inline
statement with a version number ("Requires Node.js >= 20", "works with
Python 3.11").

### C305 contributing (4)

Passes with a Contributing section or a link to CONTRIBUTING.md. A
CONTRIBUTING.md that exists in the project but is never linked earns 0.5.

### C306 visual-demo (3)

Passes with any non-badge image: screenshot, terminal-capture SVG, GIF or
an HTML `<img>` tag.

### C307 features-or-why (3)

Passes with a `Features`, `Why ...`, `Highlights` or `Motivation` section.
An unlabelled bullet list of three or more items near the top earns 0.5 —
it is probably a feature list missing its heading.

### C308 links-out (3)

Passes when the README points anywhere deeper: a `docs/` or wiki link, a
non-standard relative `.md` link, or a `Documentation` section. Links to
README/LICENSE/CONTRIBUTING/CHANGELOG themselves do not count.

## Hygiene — H4xx (16 points)

### H401 no-placeholders (4)

Fails on template leftovers in prose: `TODO`, `FIXME`, `TBD`, `lorem
ipsum`, `coming soon`, `under construction`, `your-username`, `changeme`,
`<insert ...>`. Code blocks and inline code are exempt — `<your-api-key>`
in an example is legitimate.

### H402 no-local-paths (3)

Fails when any line (code included — terminal dumps are where these leak)
contains a personal home-directory path in the macOS/Linux
(`/home/<name>/...`) or Windows (`C:\Users\<name>\...`) style.

### H403 relative-links-resolve (4)

Score is the fraction of relative links and images whose target file
exists, anchors and query strings stripped. External URLs, `#anchors` and
`mailto:` are not relative links. Skips on stdin input unless
`--project-dir` says where to look.

### H404 no-bare-urls (2)

Passes when every prose URL is wrapped in a Markdown link. One to four
bare URLs earn 0.5; five or more earn 0. URLs in code are fine.

### H405 unique-headings (3)

Passes when no two headings share the same text (case-insensitive —
GitHub derives anchors from heading text, so duplicates make deep links
land wrong). One duplicated text earns 0.5; two or more earn 0.
