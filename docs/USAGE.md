# Usage

## Synopsis

```
flowdeck <flows.csv> [flags]
```

## CSV format

Header (exact names required, extra columns ignored):

```csv
source,target,value
organic-search,landing,4200
paid-search,landing,1800
```

Rules:

- RFC4180 quoting: `"a, b"`, `"he said ""hi"""`, CRLF or LF, blank lines skipped
- `value` must be a finite number ≥ 0; errors carry the CSV line number
- duplicate `source,target` rows are **summed** into one ribbon
- self-loops (`a → a`) and dependency cycles are rejected (exit 2, nodes named)

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--svg PATH` | `<stem>.svg` in cwd when no other output flag is given | write the SVG diagram |
| `--html PATH` | – | write the self-contained gallery (inline SVG + tables) |
| `--json PATH` | – | write graph statistics + top links as JSON |
| `--title TEXT` | `Flow: <file>` | diagram title |
| `--palette NAME` | `default` | `default`, `warm`, or `cool` |
| `--width` / `--height` | 960 / 640 | diagram size in px |
| `--top N` | 5 | flows shown in the console summary (`0` disables) |
| `--version`, `--help` | – | print and exit 0 |

## Exit codes

`0` success · `2` usage or input error (there is no "warning" exit: a rendered
diagram always reflects fully validated input).

## Recipes

**Diagram only (default file name):**

```shell
flowdeck examples/flows.csv          # writes flows.svg in the current directory
```

**Everything:**

```shell
flowdeck examples/flows.csv --svg out.svg --html out.html --json out.json \
  --title "Site traffic flow"
```

**Fit a slide:**

```shell
flowdeck examples/spend.csv --svg spend.svg --width 800 --height 500 --palette cool
```

**CI check that the CSV still parses** (e.g., generated exports):

```yaml
- name: Flow export is valid
  run: node src/cli.js exports/weekly.csv --svg /tmp/weekly.svg
```

**Pipe stats into `jq`:**

```shell
flowdeck examples/flows.csv --json out.json --top 0 >/dev/null
jq '.stats.totalValue' out.json
```

## JSON shape

```json
{
  "tool": "flowdeck",
  "version": "0.1.0",
  "source": "examples/flows.csv",
  "title": "Site traffic flow",
  "palette": "default",
  "stats": {
    "nodeCount": 13, "linkCount": 17, "layerCount": 6, "totalValue": 28100,
    "perLayer": [{ "layer": 0, "nodes": 5, "value": 11000 }, "..."],
    "columns": [{ "layer": 0, "x": 24, "nodes": 5, "value": 11000 }, "..."],
    "scale": 28.4, "bounds": { "width": 960, "height": 640, "padding": 24 }
  },
  "topLinks": [{ "source": "organic-search", "target": "landing", "value": 4200 }]
}
```

## Reading the diagram

- **Column** = layer (longest-path stage); node labels sit right of the node,
  except the last column where they sit left.
- **Node height** = value flowing through it (`max(in, out)`).
- **Ribbon thickness** = link value at the shared scale; hover (or a screen
  reader) reads `source → target: value`.
