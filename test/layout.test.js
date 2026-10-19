import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFlows } from "../src/csv.js";
import { buildGraph } from "../src/graph.js";
import { layout, ribbonPath, DEFAULTS } from "../src/layout.js";

const build = (csv, opts) => {
  const graph = buildGraph(parseFlows(csv).links);
  return { graph, laid: layout(graph, opts) };
};

const CHAIN = "source,target,value\na,b,10\nb,c,10\n";

test("column x positions increase with layer and stay inside padding", () => {
  const { laid } = build(CHAIN, { width: 600, height: 300, padding: 24, nodeWidth: 18 });
  const ax = laid.nodeBoxes.get("a").x;
  const bx = laid.nodeBoxes.get("b").x;
  const cx = laid.nodeBoxes.get("c").x;
  assert.ok(ax < bx && bx < cx);
  assert.ok(ax >= 24 - 1e-9);
  assert.ok(cx + 18 <= 600 - 24 + 1e-9);
});

test("nodes stack top-to-bottom without overlapping within a column", () => {
  const { laid } = build(
    "source,target,value\ns,t1,10\ns,t2,20\ns,t3,30\n",
    { width: 600, height: 400 }
  );
  const boxes = ["t1", "t2", "t3"].map((n) => laid.nodeBoxes.get(n));
  const sorted = [...boxes].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i].y >= sorted[i - 1].y + sorted[i - 1].height);
  }
  const last = sorted[sorted.length - 1];
  assert.ok(last.y + last.height <= 400 - 24 + 1e-9, "column must fit the height");
});

test("shared scale makes the tightest column fit exactly", () => {
  const { laid } = build(
    "source,target,value\ns,a,100\ns,b,100\ns,c,100\n",
    { height: 400, padding: 24, nodeGap: 12 }
  );
  const col = laid.stats.columns[1];
  const expected =
    col.value * laid.scale + (col.nodes - 1) * 12;
  assert.ok(Math.abs(expected - (400 - 48)) < 1e-6);
});

test("node heights are proportional to their values", () => {
  const { laid } = build(
    "source,target,value\ns,big,30\ns,small,10\n",
    { height: 400 }
  );
  const big = laid.nodeBoxes.get("big");
  const small = laid.nodeBoxes.get("small");
  assert.ok(Math.abs(big.height - 3 * small.height) < 1e-6);
});

test("zero-value nodes still render with a minimum height", () => {
  const { laid } = build(
    "source,target,value\ns,t,10\nt,u,0\n",
    { height: 300 }
  );
  assert.equal(laid.nodeBoxes.get("u").height, 1);
});

test("ribbons span exactly from source right edge to target left edge", () => {
  const { laid } = build(CHAIN, { width: 600, padding: 24, nodeWidth: 18 });
  // Chain a→b→c: columns at x = 24, 291, 558 (usable width 534, 3 layers).
  const r = laid.ribbons[0]; // values tie → sorted by source name: a→b first
  assert.equal(r.source, "a");
  assert.equal(r.sourceBox.x + r.sourceBox.width, 42);
  assert.equal(r.targetBox.x, 24 + (600 - 48 - 18) / 2); // middle column
  assert.ok(r.d.startsWith("M 42 "));
  assert.ok(r.d.includes("L " + (24 + (600 - 48 - 18) / 2) + " "));
  const last = laid.ribbons.at(-1);
  assert.equal(last.targetBox.x, 600 - 24 - 18); // final column reaches the right edge
});

test("ribbon offsets stay inside their node boxes", () => {
  const { laid } = build(
    "source,target,value\ns,x,40\ns,y,60\nx,e,40\ny,e,60\n",
    { height: 400 }
  );
  for (const r of laid.ribbons) {
    const sb = r.sourceBox;
    const tb = r.targetBox;
    assert.ok(r.sy0 >= sb.y - 1e-9 && r.sy1 <= sb.y + sb.height + 1e-9,
      `source span in ${r.source}→${r.target}`);
    assert.ok(r.ty0 >= tb.y - 1e-9 && r.ty1 <= tb.y + tb.height + 1e-9,
      `target span in ${r.source}→${r.target}`);
  }
});

test("ribbons are drawn thick-first for a stable painter order", () => {
  const { laid } = build(
    "source,target,value\ns,x,10\ns,y,100\n",
    { height: 300 }
  );
  const values = laid.ribbons.map((r) => r.value);
  assert.deepEqual(values, [...values].sort((a, b) => b - a));
});

test("single-node graph does not crash (maxLayer 0)", () => {
  // A lone node can only appear with a self-loop (rejected earlier), so the
  // degenerate case is an all-zero edge that still layers two nodes.
  const { laid } = build("source,target,value\na,b,0\n", { width: 400, height: 200 });
  assert.equal(laid.nodeBoxes.size, 2);
  assert.ok(laid.ribbons[0].thickness >= 0);
});

test("ribbonPath produces a closed filled shape", () => {
  const sb = { x: 0, width: 10, y: 0, height: 40 };
  const tb = { x: 100, width: 10, y: 0, height: 40 };
  const d = ribbonPath(sb, tb, 0, 10, 20, 30);
  assert.ok(d.startsWith("M 10 0"));
  assert.ok(d.endsWith("Z"));
  assert.equal((d.match(/C /g) || []).length, 2);
});

test("defaults are sane", () => {
  assert.ok(DEFAULTS.width > 0 && DEFAULTS.height > 0);
  assert.ok(DEFAULTS.nodeWidth > 0 && DEFAULTS.nodeGap >= 0);
});
