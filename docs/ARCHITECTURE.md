# Architecture

## Design goals

1. **Deterministic** — identical CSV ⇒ byte-identical SVG/HTML/JSON (test
   pins this), so diagrams can live in version control.
2. **Zero dependencies** — hand-rolled CSV parser and SVG renderer on Node's
   standard library only.
3. **Geometry you can trust** — layout invariants (fits the box, no column
   overlaps, ribbons inside node edges) are unit-tested, not eyeballed.
4. **Honest input handling** — cycles, self-loops, bad numbers: rejected with
   line numbers and named nodes, never half-rendered.

## Pipeline

```
flows.csv
   │
   ▼
csv.parseFlows          RFC4180 state machine (quotes, "" escapes, CRLF);
   │                    header requires source,target,value; value finite ≥ 0;
   │                    duplicate source→target merged (summed); self-loops rejected
   ▼
buildGraph              node values = max(in, out); Kahn longest-path layering
   │                    → cycle error names every stuck node
   │                    → 4 barycenter sweeps (forward/backward) order each
   │                      layer by predecessor/successor average position,
   │                      ties broken by name (determinism)
   ▼
layout                  shared value→px scale = tightest column's budget
   │                    nodes stacked top-down per column, vertically centered
   │                    link offsets nest from each edge, sorted by partner
   │                    center; ribbons sorted thick-first (painter's order)
   ▼
svg.renderSvg           <svg role="img" aria-labelledby> + <title>/<desc>,
   │                    rect nodes, cubic ribbons, labels, XML-escaped
   ├─ html.renderHtml   inline SVG + top-flows + nodes-by-layer tables
   └─ cli               console summary + JSON stats; exit 0/2
```

## Key decisions

### Longest-path layering

`layer(n) = 1 + max(layer(preds))`. Shortest-path layering would drop a node
next to a long detour it also participates in; longest-path keeps every ribbon
left-to-right (there is a test: `a→d` plus `a→b→c→d` puts `d` at layer 3).

### Node value = max(in, out)

Standard Sankey semantics: a node's height is what flows through it. For
sources that is `out`, for sinks `in`. When a node's inflow and outflow differ
(traffic that "disappears" into bounce), the edge offsets nest from the top of
the box; the difference is visible slack rather than a lie. Imbalance is not
an error — many real flows leak (see Limitations).

### One shared scale

A per-column scale would make a ribbon's two ends disagree. The scale is the
minimum budget across columns that fits `height − 2·padding − gaps`, so every
column fits, and ribbons have constant thickness end-to-end.

### Determinism everywhere

- layer-ready queue sorted by name;
- barycenter ties broken by `localeCompare`;
- link offsets sorted by partner center then name;
- ribbons sorted by value desc (thin ones paint on top);
- no timestamps, no randomness — reruns compare byte-for-byte (demo proves it).

### Why `--html` embeds the SVG

One file, open anywhere, no network and no sibling files — it behaves like a
screenshot you can re-zoom. The `<desc>` and per-element `<title>` tooltips
also make the diagram screen-reader navigable.

## Exit codes

| code | meaning |
|---|---|
| 0 | success (diagram and/or summary produced) |
| 2 | usage/input error: bad flags, unreadable file, malformed CSV, cycle, self-loop |
