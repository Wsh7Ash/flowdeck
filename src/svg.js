/**
 * SVG rendering: node rects, bezier ribbons, labels, accessible wrapper.
 * Everything is escaped; output is deterministic for a given input.
 */

export const PALETTES = {
  default: ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
    "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac"],
  warm: ["#b5442e", "#e08e45", "#d4a72c", "#8f6b3f", "#c25b56",
    "#a8531f", "#d98c3f", "#7a4a31", "#e2b33f", "#945136"],
  cool: ["#3f6fa3", "#4f9db9", "#57a88a", "#5b8fd6", "#7a6bb5",
    "#3f8f7a", "#6a9ec9", "#8873c7", "#4c7ea8", "#5aa4a0"],
};

/** Deterministic palette pick: FNV-1a over the node name. */
export function colorFor(name, palette = PALETTES.default) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return palette[h % palette.length];
}

export function escapeXml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * renderSvg({graph, laid, title, paletteName}) -> SVG document string.
 */
export function renderSvg({ graph, laid, title = "Sankey flow diagram", paletteName = "default" }) {
  const palette = PALETTES[paletteName] ?? PALETTES.default;
  const { nodes, layers } = graph;
  const { width, height, nodeBoxes, ribbons, nodeWidth } = laid;
  const maxLayer = Math.max(0, layers.length - 1);

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
      `width="${width}" height="${height}" role="img" aria-labelledby="fd-title fd-desc">`
  );
  parts.push(`<title id="fd-title">${escapeXml(title)}</title>`);
  parts.push(
    `<desc id="fd-desc">Sankey diagram: ${nodes.size} nodes, ${ribbons.length} flows, ` +
      `${layers.length} layers.</desc>`
  );
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);

  // Ribbons first (under nodes); thick ones are already first.
  parts.push('<g class="links" fill-opacity="0.35">');
  for (const r of ribbons) {
    const color = colorFor(r.source, palette);
    parts.push(
      `<path d="${r.d}" fill="${color}"><title>${escapeXml(r.source)} → ` +
        `${escapeXml(r.target)}: ${fmt(r.value)}</title></path>`
    );
  }
  parts.push("</g>");

  parts.push('<g class="nodes">');
  for (const [name, box] of nodeBoxes) {
    const color = colorFor(name, palette);
    const last = box.layer === maxLayer;
    const labelX = last ? box.x - 6 : box.x + nodeWidth + 6;
    const anchor = last ? "end" : "start";
    parts.push(
      `<rect x="${fmt(box.x)}" y="${fmt(box.y)}" width="${box.width}" ` +
        `height="${fmt(Math.max(box.height, 1))}" rx="3" fill="${color}">` +
        `<title>${escapeXml(name)}: ${fmt(box.value)}</title></rect>`
    );
    parts.push(
      `<text x="${fmt(labelX)}" y="${fmt(box.y + Math.max(box.height, 1) / 2)}" ` +
        `dy="0.35em" text-anchor="${anchor}" font-family="system-ui, sans-serif" ` +
        `font-size="12" fill="#222">${escapeXml(name)}</text>`
    );
  }
  parts.push("</g>");
  parts.push("</svg>\n");
  return parts.join("\n");
}
