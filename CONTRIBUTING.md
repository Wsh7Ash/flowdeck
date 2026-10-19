# Contributing to flowdeck

Thanks for considering a contribution.

## Development setup

```shell
git clone https://github.com/Wsh7Ash/flowdeck.git
cd flowdeck
npm test               # node --test → 55 cases
node examples/demo.mjs # end-to-end demo + artifacts
```

There is nothing to install: flowdeck has **zero npm dependencies**.

## Ground rules

1. **Determinism is a feature.** Never introduce randomness, timestamps, or
   iteration order that depends on object insertion beyond what tests pin.
   The byte-identical rerun test must keep passing.
2. **Geometry needs a test.** Any layout change must assert its invariants
   (fits the height, no overlaps, ribbons inside edges) rather than relying
   on eyeballing.
3. **Reject, don't render.** Malformed input, cycles, and self-loops exit 2
   with line numbers / named nodes.
4. **Zero runtime dependencies** — reject PRs that add a package for something
   the standard library can do.
5. **No fabricated results** — `results/` only via `node examples/demo.mjs`.

## Workflow

1. Open an issue describing the bug or idea.
2. Branch from `main`: `git checkout -b fix/short-description`.
3. Add tests alongside the change.
4. `npm test` and `node examples/demo.mjs` must be green.
5. Update `CHANGELOG.md` and docs if behavior changed.
6. Open a pull request; CI runs tests + demo on Node 20 and 22.

## Reporting bugs

Include your Node version, the exact command, a minimal CSV that reproduces
the problem (never real confidential data), and the full output. For layout
bugs, describe the expected vs actual geometry (which node/ribbon, which
numbers).
