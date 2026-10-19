/**
 * RFC4180-style CSV parsing plus flow-table validation.
 *
 * parseCsv(text)   -> { headers, rows } where each row is { cells, line }
 * parseFlows(text) -> { links: [{source, target, value}] } after validation:
 *   header must contain source, target, value; value finite and >= 0;
 *   empty rows skipped; duplicate source→target rows are merged (summed).
 * Both throw FlowError with a line-numbered message.
 */

export class FlowError extends Error {}

/** State-machine CSV tokenizer: quotes, "" escapes, CRLF, tracks line starts. */
function tokenize(text) {
  const rows = [];
  let cells = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;
  let started = false; // did the current row collect any character?

  const pushCell = () => {
    cells.push(field);
    field = "";
    started = true;
  };
  const pushRow = () => {
    pushCell();
    rows.push({ cells, line: rowStartLine });
    cells = [];
    rowStartLine = line;
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (field.length > 0) {
        throw new FlowError(`line ${line}: unexpected quote inside an unquoted field`);
      }
      inQuotes = true;
      started = true;
      continue;
    }
    if (ch === ",") {
      pushCell();
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      line++;
      pushRow();
      rowStartLine = line;
      continue;
    }
    field += ch;
    started = true;
  }
  if (inQuotes) {
    throw new FlowError(`line ${rowStartLine}: unterminated quoted field`);
  }
  if (started || cells.length > 0) pushRow();
  return rows;
}

export function parseCsv(text) {
  const raw = tokenize(text);
  const nonEmpty = raw.filter((r) => r.cells.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) {
    throw new FlowError("CSV file is empty");
  }
  const headerRow = nonEmpty[0];
  const headers = headerRow.cells.map((h) => h.trim());
  if (headers.some((h) => h === "")) {
    throw new FlowError(`line ${headerRow.line}: empty column name in header`);
  }
  const rows = nonEmpty.slice(1).map((r) => ({ cells: r.cells, line: r.line }));
  return { headers, rows };
}

/**
 * Validate a flow table and return merged links.
 * Duplicate source→target rows are summed into one link (line of the first
 * occurrence is kept for error reporting).
 */
export function parseFlows(text) {
  const { headers, rows } = parseCsv(text);
  const required = ["source", "target", "value"];
  const index = {};
  for (const name of required) {
    const at = headers.indexOf(name);
    if (at === -1) {
      throw new FlowError(
        `missing required column '${name}' in header ` +
          `(found: ${headers.join(", ") || "(none)"}; need: ${required.join(", ")})`
      );
    }
    index[name] = at;
  }
  if (rows.length === 0) {
    throw new FlowError("CSV has a header but no data rows");
  }

  const merged = new Map();
  for (const row of rows) {
    const source = (row.cells[index.source] ?? "").trim();
    const target = (row.cells[index.target] ?? "").trim();
    const rawValue = (row.cells[index.value] ?? "").trim();
    if (source === "" || target === "") {
      throw new FlowError(`line ${row.line}: source and target must be non-empty`);
    }
    const value = Number(rawValue);
    if (rawValue === "" || !Number.isFinite(value)) {
      throw new FlowError(
        `line ${row.line}: value '${rawValue}' is not a finite number`
      );
    }
    if (value < 0) {
      throw new FlowError(`line ${row.line}: value ${value} must be >= 0`);
    }
    if (source === target) {
      throw new FlowError(
        `line ${row.line}: self-loop '${source}' → '${target}' has no place in a Sankey layout`
      );
    }
    const key = `${source}\u0000${target}`;
    const existing = merged.get(key);
    if (existing) {
      existing.value += value;
    } else {
      merged.set(key, { source, target, value, line: row.line });
    }
  }
  return { links: [...merged.values()] };
}
