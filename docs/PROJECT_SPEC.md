# PROJECT SPEC — flowdeck

- **Name:** flowdeck
- **Category:** visualization
- **Date:** 2026-10-19

## Target user

An analyst, product manager, or ops lead who has a `source,target,value` CSV
(budget spend, traffic paths, funnel stages, supply chains) and needs a
presentation-ready flow diagram **without** installing a charting platform.

## Problem

Sankey diagrams are the clearest way to show how quantity moves through a
system, but the usual paths are heavy: browser drag-and-drop tools, Python
plotting stacks, or hand-drawn slides. A plain CSV in, a polished SVG/HTML out,
deterministically, from the terminal, is what people actually want.

## Solution

A zero-dependency Node CLI: RFC4180 CSV → validated flow graph (cycle
detection, longest-path layering, barycenter ordering) → Sankey layout
(shared scale, stacked columns, cubic ribbons) → SVG, self-contained HTML
gallery, and JSON statistics. Same input ⇒ byte-identical output.

## Must-have features

- Strict CSV (quotes, CRLF, line-numbered errors), duplicate edges merged,
  self-loops rejected
- Cycle detection naming every node in the cycle
- Layering + 4 barycenter sweeps for few crossings (fully deterministic)
- Shared scale so every column fits the height; ribbon offsets nest inside
  node boxes; thick links drawn first
- SVG with `<title>`/`<desc>` accessibility wrappers and per-element tooltips;
  XML-escaping of hostile node names
- HTML gallery (inline SVG + top-flows + nodes-by-layer tables)
- JSON stats; exit codes 0/2

## Stack

Node.js ≥ 20, ES modules, `node --test`; no npm dependencies at all.

## Test strategy

Unit tests per module (parser, layering, geometry invariants, escaping,
determinism) plus subprocess CLI e2e asserting every exit code; demo asserts
byte-identical reruns.

## Demo/result strategy

`node examples/demo.mjs` → `results/flows.svg|html|json`, `results/spend.svg`,
error-path captures; every step asserts its expected exit code.

## Safety considerations

Offline; reads only the given CSV; writes only requested outputs; SVG text is
XML-escaped; no external resources in HTML.

## Definition of done

`npm test` + demo green, README commands verified, no secrets, published.
