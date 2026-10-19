/**
 * Sankey layout: column x positions, node stacking, link ribbon geometry.
 *
 * layout(graph, options) -> {
 *   width, height, scale, nodeWidth,
 *   nodeBoxes: Map<name, {x, y, width, height, layer, value}>,
 *   ribbons: [{source, target, value, sourceBox, targetBox,
 *              sy0, sy1, ty0, ty1, d}],
 *   stats
 * }
 */

export const DEFAULTS = {
  width: 960,
  height: 640,
  padding: 24,
  nodeWidth: 18,
  nodeGap: 12,
  minThickness: 0.6,
};

/**
 * Compute a shared value→pixel scale that fits every column, then stack
 * nodes top-to-bottom per column and route each link as a cubic ribbon.
 */
export function layout(graph, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const { nodes, layers } = graph;
  const { width, height, padding, nodeWidth, nodeGap } = opt;
  const usableW = Math.max(1, width - 2 * padding - nodeWidth);
  const usableH = Math.max(1, height - 2 * padding);
  const maxLayer = Math.max(0, layers.length - 1);

  const xForLayer = (l) =>
    maxLayer === 0 ? padding + usableW / 2 : padding + (l * usableW) / maxLayer;

  // Shared scale: the tightest column decides.
  let scale = Infinity;
  let maxNodes = 1;
  layers.forEach((names) => {
    maxNodes = Math.max(maxNodes, names.length);
    const sum = names.reduce((s, n) => s + nodes.get(n).value, 0);
    if (sum > 0) {
      const gaps = Math.max(0, names.length - 1) * nodeGap;
      scale = Math.min(scale, (usableH - gaps) / sum);
    }
  });
  if (!Number.isFinite(scale)) scale = 1; // every value is zero
  scale = Math.max(scale, 0);

  // Stack nodes per column.
  const nodeBoxes = new Map();
  const yCenters = new Map();
  layers.forEach((names, l) => {
    const gaps = Math.max(0, names.length - 1) * nodeGap;
    const used =
      names.reduce((s, n) => s + Math.max(nodes.get(n).value * scale, 0), 0) +
      gaps;
    let y = padding + Math.max(0, (usableH - used) / 2);
    for (const name of names) {
      const node = nodes.get(name);
      const h = Math.max(node.value * scale, node.value > 0 ? 0 : 1);
      const box = { x: xForLayer(l), y, width: nodeWidth, height: h, layer: l, value: node.value };
      nodeBoxes.set(name, box);
      yCenters.set(name, y + h / 2);
      y += h + nodeGap;
    }
  });

  // Ribbons: order links by the partner's y-center so offsets nest cleanly.
  const ribbons = [];
  const outCursor = new Map(); // node name -> next y offset on its right edge
  const inCursor = new Map();
  const links = [...nodes.values()].flatMap((n) => n.outs);
  const sorted = [...links].sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target)
  );

  const ensureCursors = (name) => {
    if (!outCursor.has(name)) outCursor.set(name, nodeBoxes.get(name).y);
    if (!inCursor.has(name)) inCursor.set(name, nodeBoxes.get(name).y);
  };

  // First pass: group by node and order by partner center for stable nesting.
  const outsByNode = new Map();
  const insByNode = new Map();
  for (const link of sorted) {
    if (!outsByNode.has(link.source)) outsByNode.set(link.source, []);
    if (!insByNode.has(link.target)) insByNode.set(link.target, []);
    outsByNode.get(link.source).push(link);
    insByNode.get(link.target).push(link);
  }
  for (const list of outsByNode.values()) {
    list.sort(
      (a, b) => yCenters.get(a.target) - yCenters.get(b.target) || a.target.localeCompare(b.target)
    );
  }
  for (const list of insByNode.values()) {
    list.sort(
      (a, b) => yCenters.get(a.source) - yCenters.get(b.source) || a.source.localeCompare(b.source)
    );
  }

  for (const link of sorted) {
    ensureCursors(link.source);
    ensureCursors(link.target);
    const sb = nodeBoxes.get(link.source);
    const tb = nodeBoxes.get(link.target);
    const t = Math.max(link.value * scale, opt.minThickness);
    const sy0 = outCursor.get(link.source);
    const ty0 = inCursor.get(link.target);
    outCursor.set(link.source, sy0 + t);
    inCursor.set(link.target, ty0 + t);
    ribbons.push({
      source: link.source,
      target: link.target,
      value: link.value,
      thickness: t,
      sourceBox: sb,
      targetBox: tb,
      sy0,
      sy1: sy0 + t,
      ty0,
      ty1: ty0 + t,
      d: ribbonPath(sb, tb, sy0, sy0 + t, ty0, ty0 + t),
    });
  }

  // Painter's algorithm: draw thick ribbons underneath thin ones.
  ribbons.sort((a, b) => b.value - a.value || a.source.localeCompare(b.source));

  const stats = {
    scale,
    columns: layers.map((names, l) => ({
      layer: l,
      x: xForLayer(l),
      nodes: names.length,
      value: names.reduce((s, n) => s + nodes.get(n).value, 0),
    })),
    bounds: { width, height, padding },
  };
  return { width, height, nodeWidth, scale, nodeBoxes, ribbons, stats };
}

/** Cubic ribbon between two vertical spans (filled shape). */
export function ribbonPath(sb, tb, sy0, sy1, ty0, ty1) {
  const x0 = sb.x + sb.width;
  const x1 = tb.x;
  const cx = (x0 + x1) / 2;
  return [
    `M ${x0} ${sy0}`,
    `C ${cx} ${sy0}, ${cx} ${ty0}, ${x1} ${ty0}`,
    `L ${x1} ${ty1}`,
    `C ${cx} ${ty1}, ${cx} ${sy1}, ${x0} ${sy1}`,
    "Z",
  ].join(" ");
}
