# Changelog

All notable changes to flowdeck are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-10-19

### Added
- RFC4180 CSV parser (quotes, `""` escapes, CRLF, line tracking) with strict
  flow validation: required header, finite ≥ 0 values, duplicate-edge merging,
  self-loop rejection, line-numbered errors.
- Flow graph: `max(in, out)` node values, Kahn longest-path layering with
  cycle detection naming the stuck nodes, 4 deterministic barycenter sweeps.
- Sankey layout: shared scale across columns, centered stacking, nested link
  offsets, cubic ribbons, painter-ordered thick-first rendering.
- SVG output with `role="img"`, `<title>`/`<desc>`, per-element tooltips,
  XML escaping, `default|warm|cool` palettes.
- `--html` self-contained gallery (inline SVG + top-flows + nodes-by-layer
  tables) and `--json` statistics.
- Exit codes 0/2; `node --test` suite (55 cases); `examples/demo.mjs`
  asserting every exit code plus byte-identical reruns.
