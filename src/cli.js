#!/usr/bin/env node
/**
 * flowdeck CLI — CSV → Sankey SVG/HTML/JSON.
 *
 * Exit codes: 0 success · 2 usage or input error.
 */

import fs from "node:fs";
import path from "node:path";
import { FlowError, parseFlows } from "./csv.js";
import { buildGraph, graphStats } from "./graph.js";
import { layout } from "./layout.js";
import { renderSvg, PALETTES } from "./svg.js";
import { renderHtml } from "./html.js";

export const VERSION = "0.1.0";

const USAGE = `usage: flowdeck <flows.csv> [flags]

flags:
  --svg PATH        write the SVG diagram
  --html PATH       write a self-contained HTML gallery (inline SVG + tables)
  --json PATH       write graph statistics as JSON
  --title TEXT      diagram title (default: CSV file name)
  --palette NAME    ${Object.keys(PALETTES).join(" | ")} (default: default)
  --width N         diagram width px (default: 960)
  --height N        diagram height px (default: 640)
  --top N           flows listed in the console summary (default: 5)
  --version         print version and exit
  --help            print this help and exit

CSV format (header required):
  source,target,value
  search,product,1200

exit codes: 0 success, 2 usage/input error`;

function parseIntFlag(name, raw, { min = 1 } = {}) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) {
    throw new FlowError(`${name} must be an integer >= ${min} (got '${raw}')`);
  }
  return n;
}

export function parseArgs(argv) {
  const opts = {
    csv: null, svg: null, html: null, json: null,
    title: null, palette: "default", width: 960, height: 640, top: 5,
    help: false, version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new FlowError(`${arg} requires a value`);
      return argv[++i];
    };
    switch (arg) {
      case "--svg": opts.svg = next(); break;
      case "--html": opts.html = next(); break;
      case "--json": opts.json = next(); break;
      case "--title": opts.title = next(); break;
      case "--palette": opts.palette = next(); break;
      case "--width": opts.width = parseIntFlag("--width", next()); break;
      case "--height": opts.height = parseIntFlag("--height", next()); break;
      case "--top": opts.top = parseIntFlag("--top", next(), { min: 0 }); break;
      case "--version": opts.version = true; break;
      case "--help": case "-h": opts.help = true; break;
      default:
        if (arg.startsWith("-")) throw new FlowError(`unknown flag '${arg}'`);
        if (opts.csv !== null) throw new FlowError(`unexpected extra argument '${arg}'`);
        opts.csv = arg;
    }
  }
  return opts;
}

export function run(argv, out = process.stdout, err = process.stderr) {
  let opts;
  try {
    opts = parseArgs(argv);
    if (opts.version) {
      out.write(`flowdeck ${VERSION}\n`);
      return 0;
    }
    if (opts.help) {
      out.write(USAGE + "\n");
      return 0;
    }
    if (opts.csv === null) throw new FlowError("a flows CSV path is required (--help for usage)");
    if (!PALETTES[opts.palette]) {
      throw new FlowError(`unknown palette '${opts.palette}' (choose from ${Object.keys(PALETTES).join(", ")})`);
    }

    const text = fs.readFileSync(opts.csv, "utf8");
    const { links } = parseFlows(text);
    const graph = buildGraph(links);
    const stats = graphStats(graph);
    const laid = layout(graph, { width: opts.width, height: opts.height });
    const title = opts.title ?? `Flow: ${path.basename(opts.csv)}`;
    const svg = renderSvg({ graph, laid, title, paletteName: opts.palette });

    const wrote = [];
    const svgPath = opts.svg ?? (opts.html || opts.json ? null : path.basename(opts.csv).replace(/\.[^.]+$/, "") + ".svg");
    if (svgPath) {
      fs.writeFileSync(svgPath, svg);
      wrote.push(svgPath);
    }
    if (opts.html) {
      fs.writeFileSync(opts.html, renderHtml({ svg, title, graph, stats, sourceName: opts.csv }));
      wrote.push(opts.html);
    }
    if (opts.json) {
      fs.writeFileSync(
        opts.json,
        JSON.stringify(
          {
            tool: "flowdeck", version: VERSION, source: opts.csv, title,
            palette: opts.palette,
            stats,
            topLinks: [...links]
              .sort((a, b) => b.value - a.value || a.source.localeCompare(b.source))
              .slice(0, Math.max(opts.top, 0))
              .map((l) => ({ source: l.source, target: l.target, value: l.value })),
          },
          null,
          2
        ) + "\n"
      );
      wrote.push(opts.json);
    }

    out.write(`flowdeck ${VERSION} — ${path.basename(opts.csv)}\n`);
    out.write(
      `graph: ${stats.nodeCount} nodes, ${stats.linkCount} flows, ` +
        `${stats.layerCount} layers, total ${stats.totalValue}\n`
    );
    if (opts.top > 0) {
      out.write("top flows:\n");
      const top = [...links]
        .sort((a, b) => b.value - a.value || a.source.localeCompare(b.source))
        .slice(0, opts.top);
      for (const l of top) {
        const share = stats.totalValue ? ((l.value / stats.totalValue) * 100).toFixed(1) : "0.0";
        out.write(`  ${l.source} → ${l.target}  ${l.value} (${share}%)\n`);
      }
    }
    for (const p of wrote) out.write(`wrote ${p}\n`);
    if (wrote.length === 0) out.write("(summary only — pass --svg/--html/--json to write files)\n");
    return 0;
  } catch (e) {
    if (e instanceof FlowError || e instanceof SyntaxError || e?.code === "ENOENT") {
      err.write(`error: ${e.message}\n`);
      return 2;
    }
    throw e;
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  process.exit(run(process.argv.slice(2)));
}
