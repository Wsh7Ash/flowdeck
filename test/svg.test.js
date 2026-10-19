import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFlows } from "../src/csv.js";
import { buildGraph, graphStats } from "../src/graph.js";
import { layout } from "../src/layout.js";
import { colorFor, escapeXml, renderSvg, PALETTES } from "../src/svg.js";
import { renderHtml } from "../src/html.js";

function render(csv, opts = {}, title = "Test diagram", paletteName = "default") {
  const graph = buildGraph(parseFlows(csv).links);
  const laid = layout(graph, opts);
  return { graph, svg: renderSvg({ graph, laid, title, paletteName }) };
}

test("svg has a single rooted document with accessible title and desc", () => {
  const { svg } = render("source,target,value\na,b,10\n");
  assert.ok(svg.startsWith("<svg "));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  assert.ok(svg.includes('aria-labelledby="fd-title fd-desc"'));
  assert.ok(svg.includes('<desc id="fd-desc">'));
  assert.ok(svg.includes("Sankey diagram: 2 nodes, 1 flows, 2 layers"));
  assert.equal((svg.match(/<svg /g) || []).length, 1);
  assert.equal((svg.match(/<\/svg>/g) || []).length, 1);
});

test("node and link counts match the graph", () => {
  const csv = "source,target,value\na,b,10\na,c,5\nb,d,7\nc,d,8\n";
  const { svg } = render(csv);
  assert.equal((svg.match(/<rect /g) || []).length, 1 + 4); // bg + 4 nodes
  assert.equal((svg.match(/<path /g) || []).length, 4);
  assert.equal((svg.match(/<text /g) || []).length, 4);
});

test("special characters in node names are escaped", () => {
  const { svg } = render(
    'source,target,value\n"a<b>","x & y",10\n'
  );
  assert.ok(svg.includes("a&lt;b&gt;"));
  assert.ok(svg.includes("x &amp; y"));
  assert.ok(!svg.includes("a<b>"));
  assert.ok(!svg.includes("& y<"));
});

test("escapeXml covers all five XML special characters", () => {
  assert.equal(escapeXml(`<a href='x'>&"'</a>`),
    "&lt;a href=&apos;x&apos;&gt;&amp;&quot;&apos;&lt;/a&gt;");
});

test("flow values appear inside tooltips", () => {
  const { svg } = render("source,target,value\nalpha,beta,4200\n");
  assert.ok(svg.includes("alpha → beta: 4200"));
  assert.ok(svg.includes(">alpha: 4200</title>"));
});

test("output is byte-deterministic for the same input", () => {
  const csv = "source,target,value\na,b,10\na,c,5\nb,d,7\n";
  assert.equal(render(csv).svg, render(csv).svg);
});

test("palette choice changes colors but not structure", () => {
  const csv = "source,target,value\na,b,10\n";
  const def = render(csv, {}, "T", "default").svg;
  const warm = render(csv, {}, "T", "warm").svg;
  assert.notEqual(def, warm);
  assert.equal(
    (def.match(/<path /g) || []).length,
    (warm.match(/<path /g) || []).length
  );
  // Unknown palette falls back to default rather than crashing.
  const fallback = render(csv, {}, "T", "neon").svg;
  assert.equal(fallback, def);
});

test("colorFor is deterministic and stays inside the palette", () => {
  const palette = PALETTES.cool;
  for (const name of ["alpha", "beta", "gamma", "delta"]) {
    const a = colorFor(name, palette);
    assert.equal(a, colorFor(name, palette));
    assert.ok(palette.includes(a), `${name} → ${a} not in palette`);
  }
  assert.notEqual(colorFor("alpha"), colorFor("zeta-4"));
});

test("renderHtml embeds the svg and stats tables", () => {
  const csv = "source,target,value\na,b,10\na,c,5\nb,d,7\nc,d,8\n";
  const graph = buildGraph(parseFlows(csv).links);
  const stats = graphStats(graph);
  const laid = layout(graph, { width: 600, height: 300 });
  const svg = renderSvg({ graph, laid, title: "T" });
  const html = renderHtml({ svg, title: "T", graph, stats, sourceName: "x.csv" });
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("<svg"));
  assert.ok(html.includes("Top flows"));
  assert.ok(html.includes("Nodes by layer"));
  assert.ok(html.includes("<code>x.csv</code>"));
  assert.ok(html.includes("total 30"));
  assert.equal((html.match(/<\/html>/g) || []).length, 1);
});

test("html escapes hostile names too", () => {
  const csv = 'source,target,value\n"a<b>","c&d",3\n';
  const graph = buildGraph(parseFlows(csv).links);
  const stats = graphStats(graph);
  const laid = layout(graph, {});
  const svg = renderSvg({ graph, laid, title: "<script>x</script>" });
  const html = renderHtml({ svg, title: "<script>x</script>", graph, stats, sourceName: "<f>.csv" });
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>x</script>"));
  assert.ok(html.includes("&lt;f&gt;.csv"));
});
