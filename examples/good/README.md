# driftwood

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) ![Version 1.4.2](https://img.shields.io/badge/version-1.4.2-informational)

**driftwood archives your bookmarks as plain files on your own disk — full-text searchable, offline forever, no account required.**

![driftwood terminal preview](docs/preview.svg)

Browser bookmarks rot: pages move, sites die, and the export formats change
every year. driftwood fetches each bookmarked page once, stores a readable
snapshot next to a small metadata file, and gives you a fast local search
across everything you ever saved. Requires Node.js >= 20; nothing else.

## Features

- **Plain files, no database** — every bookmark is a folder you can grep, back up and sync.
- **Full-text search** — `driftwood find` answers in milliseconds, entirely offline.
- **Import everything** — reads Netscape HTML exports from any major browser.
- **Honest snapshots** — pages are stored as they were fetched, with the fetch date.

## Install

```bash
npm install -g driftwood-cli
```

## Usage

Import an export file and search your archive:

```bash
driftwood import bookmarks-export.html
driftwood find "static site generators"
```

Output:

```text
imported 312 bookmarks (9 duplicates skipped)
3 matches:
  2024-11-02  Eleventy vs Hugo: a practical comparison
  2023-06-17  The case for boring static sites
  2021-01-30  Build a static site with make(1)
```

Snapshots land in `~/driftwood/` by default; see
[docs/configuration.md](docs/configuration.md) for every knob.

## Contributing

Bug reports and pull requests are welcome — start with
[CONTRIBUTING.md](CONTRIBUTING.md) for the test and formatting workflow.

## License

[MIT](LICENSE)
