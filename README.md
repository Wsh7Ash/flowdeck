# flowdeck

**Turn a `source,target,value` CSV into a laid-out Sankey diagram — SVG, HTML gallery, and stats, with zero dependencies.**

## The problem

When quantity moves through a system — traffic through pages, budget through
categories, stock through suppliers — a table hides the story and a chart
library wants a toolchain. People end up redrawing Sankeys by hand in slides.

flowdeck does the whole path offline in one command: validated CSV in, a
layered, crossing-reduced, byte-deterministic SVG (plus a self-contained HTML
gallery and JSON stats) out.

## Key features

- **Real Sankey layout** — longest-path layering, barycenter ordering to reduce
  crossings, one shared value→pixel scale so every column fits, ribbons that
  nest exactly inside node edges, thick links painted first.
- **Strict, friendly input** — RFC4180 CSV (quotes, CRLF), line-numbered
  errors, duplicate edges merged, self-loops and cycles rejected **by name**.
- **Byte-deterministic** — the same CSV always produces the identical SVG
  (the demo verifies it), so diagrams can live in version control.
- **Accessible output** — `role="img"` + `<title>`/`<desc>`, per-element
  tooltips (`search → landing: 4200`), XML-escaped hostile names.
- **Three outputs, one run** — `--svg`, `--html` (inline SVG + top-flow and
  per-layer tables), `--json` (stats + top links).
- **Zero npm dependencies** — Node ≥ 20 standard library only.

## Example

```console
$ flowdeck examples/flows.csv --svg out.svg --html out.html --json out.json --title "Site traffic flow"
flowdeck 0.1.0 — flows.csv
graph: 13 nodes, 17 flows, 6 layers, total 28100
top flows:
  organic-search → landing  4200 (14.9%)
  landing → bounce  3600 (12.8%)
  direct → landing  2600 (9.3%)
  landing → pricing  2400 (8.5%)
  landing → blog  2100 (7.5%)
wrote out.svg
wrote out.html
wrote out.json
```

Committed demo artifacts: [`results/flows.svg`](results/flows.svg),
[`results/flows.html`](results/flows.html) (open it — it needs no server),
[`results/flows.json`](results/flows.json), [`results/spend.svg`](results/spend.svg).

## Architecture

```
csv.js (RFC4180 + validation) → graph.js (layers, ordering, cycles)
  → layout.js (scale, stacking, cubic ribbons) → svg.js / html.js → cli.js
```

Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requirements

- Node.js 20 or newer (the test runner and `--test` flag; no packages to install)

## Installation

```shell
# from a checkout
node src/cli.js --help
npm link            # optional: puts `flowdeck` on your PATH
```

## Quick start

```shell
node src/cli.js examples/flows.csv          # writes flows.svg in the cwd
```

## Usage

```shell
flowdeck data.csv                              # default: <stem>.svg in cwd
flowdeck data.csv --html report.html           # gallery for sharing
flowdeck data.csv --width 1200 --height 700 --palette warm --title "Q3 spend"
flowdeck data.csv --json stats.json --top 0    # stats only
flowdeck --help
```

Full flag reference and recipes: [docs/USAGE.md](docs/USAGE.md).

### CSV format

```csv
source,target,value
organic-search,landing,4200
paid-search,landing,1800
```

## Configuration

Flags only — no config file, no network, no environment variables.

## Testing

```shell
npm test               # node --test → 55 tests
node examples/demo.mjs # end-to-end demo, asserts every exit code
```

55 test cases: CSV tokenizer edge cases, line-numbered validation errors,
layering (chain/diamond/longest-path/cycle), geometry invariants (column fit,
no overlaps, ribbon endpoints and nesting), XML escaping, determinism, and
subprocess CLI e2e for exit codes 0/2.

## Project structure

```
flowdeck/
├─ src/
│  ├─ csv.js      # RFC4180 parser + flow validation
│  ├─ graph.js    # node values, cycle detection, layering, barycenter order
│  ├─ layout.js   # shared scale, stacking, ribbon geometry
│  ├─ svg.js      # SVG renderer, palettes, escaping
│  ├─ html.js     # self-contained gallery page
│  └─ cli.js      # flags, outputs, summary, exit codes
├─ test/          # 55 node:test cases
├─ examples/      # flows.csv, spend.csv, demo.mjs
├─ results/       # generated demo artifacts
└─ docs/          # PROJECT_SPEC, ARCHITECTURE, USAGE
```

## Limitations

- DAGs only — cycles and self-loops are rejected (a Sankey has no defined
  left-to-right rendering for them).
- Flows need not be conserved: a node with `in ≠ out` sizes itself to
  `max(in, out)` and edge offsets nest from the top; leakage is drawn as slack,
  not reported as a warning.
- Crossing reduction is a heuristic (4 barycenter sweeps), not a global
  optimum.
- Node labels are plain single-line text; no wrapping for very long names.
- One palette is per-run; per-node colors are chosen deterministically from a
  hash of the node name (not from the CSV — a `color` column is not yet read).

## Roadmap

- Optional `color` column and label wrapping with text measurement
- Imbalance report (`in ≠ out`) in `--json` and the console summary
- `--collapse N` merging small nodes/links
- Bidirectional (left-right or top-bottom) orientation flag

## Security notes

Offline: reads only the CSV path you pass and writes only the output paths you
request. All CSV content is XML-escaped before it reaches the SVG/HTML, so a
hostile filename or node name cannot inject markup. No dependencies means no
supply chain to audit.

## License

MIT — see [LICENSE](LICENSE).
