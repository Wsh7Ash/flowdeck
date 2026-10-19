# Results

Honest record of what was actually executed for flowdeck on 2026-10-19.

## Environment

- OS: Windows 11 (MINGW64_NT-10.0-19044, x86_64), MSYS2 MinGW shell
- Runtime: Node.js v24.13.0 (ES modules, `"type": "module"`)
- Dependency manager: none — flowdeck has **zero npm dependencies**; `npm test`
  only invokes the built-in test runner

## Validation performed

| Gate | Result | Evidence |
|---|---|---|
| install | N/A | no dependencies; nothing to install |
| build | N/A | no build step |
| syntax | **PASS** | `node --check` on all `src/*.js` + `examples/*.mjs` → exit 0 |
| unit tests | **PASS** | `npm test` (`node --test`) → `pass 55, fail 0`, exit 0 |
| integration tests | **PASS** | included in the 55: subprocess CLI e2e for exit codes 0/2, artifact writing, determinism |
| lint | N/A | no linter configured for this repo |
| type check | N/A | plain JavaScript, no type checker configured |
| demo run | **PASS** | `node examples/demo.mjs` → 15/16 `[ok]` + `[info]` lines, `demo result: ALL-OK`, exit 0 |
| README commands | **PASS** | `node src/cli.js --help`, `--version` (run from a different cwd), and the quick-start run all exit 0 |
| visual check | **PASS** | `results/flows.html` opened in a browser: accessibility tree shows 17 flow tooltips, 13 labeled node rects, and both tables rendered (screenshot capture unavailable in this environment) |
| secret scan | **PASS** | grep for `ghp_`/`github_pat_`/`AKIA…`/`sk-…`/private-key headers → no matches |

## Commands executed

```shell
for f in src/*.js examples/*.mjs; do node --check "$f"; done   # exit 0
npm test                                        # 55 pass, 0 fail, exit 0
node examples/demo.mjs                          # ALL-OK, exit 0
node src/cli.js --version                       # flowdeck 0.1.0 (from another cwd)
node src/cli.js examples/flows.csv --svg … --html … --json …   # exit 0
grep -rIlE '(ghp_|github_pat_|AKIA…|sk-…|BEGIN … PRIVATE KEY)' … # exit 1 = clean
```

## Observed result

`node examples/demo.mjs` (deterministic):

```
[ok] flows.csv → svg+html+json -> exit 0
[ok] spend.csv → svg (cool) -> exit 0
[ok] default svg name in cwd -> exit 0, default flows.svg written to cwd
[ok] cycle graph rejected -> exit 2
[ok] bad value rejected -> exit 2
[ok] missing file -> exit 2
[ok] unknown flag -> exit 2
[ok] results/flows.svg (8342 bytes) · flows.html (12725) · flows.json (1199) · spend.svg (7756)
[ok] byte-identical rerun
demo result: ALL-OK
```

Graph numbers: `examples/flows.csv` → 13 nodes, 17 flows, 6 layers,
total 28100 (verified against the CSV by hand: 11000 into `landing`,
9600 out, etc.). The browser check of `results/flows.html` shows all 17
ribbons with tooltips and both summary tables.

## Generated artifacts

- `results/flows.svg` — site-traffic Sankey (default palette, 960×640)
- `results/flows.html` — self-contained gallery (inline SVG + tables)
- `results/flows.json` — stats + top links for the same run
- `results/spend.svg` — budget Sankey (cool palette, 800×500)

Regenerate with `node examples/demo.mjs`.

## Defects found and fixed during validation

1. **`graphStats.perLayer[].layer` held the node count**, not the layer index
   (test expected `[0,1,2]`, got `[1,2,1]`). Renamed the field semantics:
   `layer` is now the index and `nodes` the count; test pins both.
2. **Test-relative path bug** — the default-output test spawned the CLI with a
   temp cwd but a relative CSV path, so it failed with ENOENT. Both that test
   and the demo now pass an absolute CSV path when the cwd differs.
3. **Wrong ribbon endpoint expectation** — my hand-computed column position
   assumed the first ribbon targeted the last column; it targets the middle
   (x=291 of 600). Test corrected after re-deriving the layout math; the
   implementation was right.

## Known limitations

- DAGs only: cycles and self-loops are rejected by design (exit 2).
- Flow conservation is not enforced; `in ≠ out` nodes render as `max(in, out)`
  with edge offsets nested from the top (leakage shows as slack, no warning).
- Crossing reduction is 4 heuristic barycenter sweeps, not a global optimum.
- Node labels are single-line (no wrapping); palette is chosen per run, with
  per-node colors hashed from names (a CSV `color` column is not read).
- Local run used Node 24; CI matrix is Node 20/22 (syntax and runner features
  used are supported on both).
