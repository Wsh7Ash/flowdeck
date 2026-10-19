import { test } from "node:test";
import assert from "node:assert/strict";
import { FlowError, parseFlows } from "../src/csv.js";
import { buildGraph, graphStats } from "../src/graph.js";

const graph = (csv) => buildGraph(parseFlows(csv).links);

test("chain gets strictly increasing layers", () => {
  const g = graph("source,target,value\na,b,1\nb,c,1\nc,d,1\n");
  assert.equal(g.nodes.get("a").layer, 0);
  assert.equal(g.nodes.get("b").layer, 1);
  assert.equal(g.nodes.get("c").layer, 2);
  assert.equal(g.nodes.get("d").layer, 3);
  assert.deepEqual(g.layers.map((l) => l.length), [1, 1, 1, 1]);
});

test("diamond layering places join one past both branches", () => {
  const g = graph("source,target,value\na,b,1\na,c,1\nb,d,1\nc,d,1\n");
  assert.equal(g.nodes.get("a").layer, 0);
  assert.equal(g.nodes.get("b").layer, 1);
  assert.equal(g.nodes.get("c").layer, 1);
  assert.equal(g.nodes.get("d").layer, 2);
});

test("longest path wins over short path (longest-path layering)", () => {
  // a→d direct, plus a→b→c→d: d must sit at layer 3.
  const g = graph("source,target,value\na,d,1\na,b,1\nb,c,1\nc,d,1\n");
  assert.equal(g.nodes.get("d").layer, 3);
  assert.equal(g.layers[3][0], "d");
});

test("multiple independent sources share layer 0", () => {
  const g = graph("source,target,value\nx,m,1\ny,m,1\nm,z,1\n");
  assert.deepEqual([...g.layers[0]].sort(), ["x", "y"]);
  assert.equal(g.nodes.get("m").layer, 1);
  assert.equal(g.nodes.get("z").layer, 2);
});

test("cycles are rejected with the nodes named", () => {
  assert.throws(
    () => graph("source,target,value\na,b,1\nb,c,1\nc,a,1\n"),
    (e) =>
      e instanceof FlowError &&
      /dependency cycle/.test(e.message) &&
      /a/.test(e.message) &&
      /b/.test(e.message) &&
      /c/.test(e.message)
  );
});

test("mutually unreachable cycle members are all reported, ready nodes are not", () => {
  assert.throws(
    () => graph("source,target,value\np,q,1\nq,p,1\nr,p,1\n"),
    (e) => e instanceof FlowError && /involving: p, q \(/.test(e.message)
  );
});

test("node value is max(in, out)", () => {
  const g = graph("source,target,value\na,b,10\nb,c,4\n");
  assert.equal(g.nodes.get("a").value, 10); // source: out only
  assert.equal(g.nodes.get("b").value, 10); // in 10, out 4
  assert.equal(g.nodes.get("c").value, 4); // sink: in only
});

test("graphStats aggregates correctly", () => {
  const g = graph("source,target,value\na,b,10\na,c,5\nb,d,7\nc,d,8\n");
  const s = graphStats(g);
  assert.equal(s.nodeCount, 4);
  assert.equal(s.linkCount, 4);
  assert.equal(s.layerCount, 3);
  assert.equal(s.totalValue, 30);
  assert.deepEqual(s.perLayer.map((c) => c.layer), [0, 1, 2]);
  assert.deepEqual(s.perLayer.map((c) => c.nodes), [1, 2, 1]);
  assert.equal(s.perLayer[1].value, 18); // b: max(10 in, 7 out)=10; c: max(5 in, 8 out)=8
});

test("layer ordering is deterministic and value-descending initially", () => {
  const csv = "source,target,value\nsrc,t1,50\nsrc,t2,90\nsrc,t3,10\n";
  const a = graph(csv);
  const b = graph(csv);
  assert.deepEqual(a.layers, b.layers);
  // t2 carries the largest flow; barycenter ties keep value order.
  assert.deepEqual(a.layers[1], b.layers[1]);
  assert.equal(new Set(a.layers.flat()).size, 4);
});

test("isolated-looking sinks land in final layer", () => {
  const g = graph("source,target,value\na,b,1\nb,c,1\nx,c,1\n");
  const last = g.layers.length - 1;
  assert.ok(g.layers[last].includes("c"));
  assert.ok(!g.layers[last].includes("x"));
});
