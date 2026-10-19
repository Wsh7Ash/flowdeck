/**
 * Flow graph construction: cycle detection, longest-path layering,
 * node values, and a deterministic barycenter ordering within layers.
 */

import { FlowError } from "./csv.js";

/**
 * buildGraph(links) -> {
 *   nodes: Map<name, {name, value, layer, inSum, outSum, outs, ins}>,
 *   layers: string[][]   // node names per layer, ordered
 * }
 * Throws FlowError naming every node on a dependency cycle.
 */
export function buildGraph(links) {
  const nodes = new Map();
  const ensure = (name) => {
    if (!nodes.has(name)) {
      nodes.set(name, {
        name,
        value: 0,
        layer: -1,
        inSum: 0,
        outSum: 0,
        ins: [],
        outs: [],
      });
    }
    return nodes.get(name);
  };
  for (const link of links) {
    const s = ensure(link.source);
    const t = ensure(link.target);
    s.outs.push(link);
    t.ins.push(link);
    s.outSum += link.value;
    t.inSum += link.value;
  }
  for (const node of nodes.values()) {
    node.value = Math.max(node.inSum, node.outSum);
  }

  layerNodes(nodes);
  return { nodes, layers: orderLayers(nodes, links) };
}

/** Kahn layering: layer = 1 + max(layer of predecessors). Detects cycles. */
function layerNodes(nodes) {
  const indeg = new Map();
  for (const node of nodes.values()) indeg.set(node.name, node.ins.length);

  const ready = [...nodes.values()]
    .filter((n) => indeg.get(n.name) === 0)
    .map((n) => n.name)
    .sort();
  let placed = 0;
  const layerOf = new Map();
  while (ready.length) {
    const name = ready.shift();
    const node = nodes.get(name);
    let layer = 0;
    for (const link of node.ins) {
      layer = Math.max(layer, layerOf.get(link.source) + 1);
    }
    layerOf.set(name, layer);
    node.layer = layer;
    placed++;
    const next = [];
    for (const link of node.outs) {
      const t = indeg.get(link.target) - 1;
      indeg.set(link.target, t);
      if (t === 0) next.push(link.target);
    }
    ready.push(...next);
    ready.sort();
  }
  if (placed !== nodes.size) {
    const stuck = [...nodes.values()]
      .filter((n) => indeg.get(n.name) > 0)
      .map((n) => n.name)
      .sort();
    throw new FlowError(
      `dependency cycle detected involving: ${stuck.join(", ")} ` +
        "(Sankey layouts need an acyclic flow)"
    );
  }
}

/**
 * Group into layers and order each layer to reduce crossings:
 * start by descending value, then 4 barycenter sweeps (forward/backward).
 * Ties break by node name so output is fully deterministic.
 */
function orderLayers(nodes, links) {
  const maxLayer = Math.max(...[...nodes.values()].map((n) => n.layer));
  const layers = [];
  for (let l = 0; l <= maxLayer; l++) {
    const group = [...nodes.values()]
      .filter((n) => n.layer === l)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
    layers.push(group.map((n) => n.name));
  }

  const position = () => {
    const pos = new Map();
    layers.forEach((names) => names.forEach((n, i) => pos.set(n, i)));
    return pos;
  };
  const bary = (name, refs, pos) => {
    const values = refs
      .map((other) => pos.get(other))
      .filter((p) => p !== undefined);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const predNames = new Map();
  const succNames = new Map();
  for (const node of nodes.values()) {
    predNames.set(node.name, node.ins.map((l) => l.source));
    succNames.set(node.name, node.outs.map((l) => l.target));
  }

  for (let sweep = 0; sweep < 4; sweep++) {
    const forward = sweep % 2 === 0;
    const order = forward
      ? layers.map((_, i) => i).slice(1)
      : layers.map((_, i) => i).slice(0, -1).reverse();
    const pos = position();
    for (const li of order) {
      const scored = layers[li].map((name) => ({
        name,
        key: forward
          ? bary(name, predNames.get(name), pos)
          : bary(name, succNames.get(name), pos),
      }));
      scored.sort((a, b) => {
        if (a.key === null && b.key === null) return a.name.localeCompare(b.name);
        if (a.key === null) return 1;
        if (b.key === null) return -1;
        return a.key - b.key || a.name.localeCompare(b.name);
      });
      layers[li] = scored.map((s) => s.name);
    }
  }
  void links;
  return layers;
}

/** Summaries used by CLI/JSON/SVG output. */
export function graphStats(graph) {
  const { nodes, layers } = graph;
  const allLinks = [...nodes.values()].flatMap((n) => n.outs);
  const totalValue = allLinks.reduce((sum, l) => sum + l.value, 0);
  return {
    nodeCount: nodes.size,
    linkCount: allLinks.length,
    layerCount: layers.length,
    totalValue,
    perLayer: layers.map((names, index) => ({
      layer: index,
      nodes: names.length,
      value: names.reduce((sum, n) => sum + nodes.get(n).value, 0),
    })),
  };
}
