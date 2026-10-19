import { test } from "node:test";
import assert from "node:assert/strict";
import { FlowError, parseCsv, parseFlows } from "../src/csv.js";

test("parses a plain table", () => {
  const { headers, rows } = parseCsv("a,b,c\n1,2,3\n4,5,6\n");
  assert.deepEqual(headers, ["a", "b", "c"]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].cells, ["1", "2", "3"]);
  assert.equal(rows[0].line, 2);
});

test("handles quoted fields, embedded commas and escaped quotes", () => {
  const { rows } = parseCsv('a,b\n"x,y","he said ""hi"""\n');
  assert.deepEqual(rows[0].cells, ["x,y", 'he said "hi"']);
});

test("handles CRLF line endings and blank lines", () => {
  const { headers, rows } = parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n");
  assert.deepEqual(headers, ["a", "b"]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1].cells, ["3", "4"]);
});

test("tracks line numbers across multi-line quoted fields", () => {
  const { rows } = parseCsv('a,b\n"line1\nline2",x\nq,w\n');
  assert.equal(rows[0].line, 2);
  assert.equal(rows[1].line, 4); // quoted newline consumed one line
});

test("rejects empty input and empty header cells", () => {
  assert.throws(() => parseCsv(""), /empty/);
  assert.throws(() => parseCsv("   \n\n"), /empty/);
  assert.throws(() => parseCsv("a,,c\n1,2,3\n"), /empty column name/);
});

test("rejects unterminated quotes and stray quotes", () => {
  assert.throws(() => parseCsv('a,b\n"oops,2\n'), /unterminated/);
  assert.throws(() => parseCsv("a,b\nx\"y,2\n"), /unexpected quote/);
});

test("parseFlows validates the header", () => {
  assert.throws(
    () => parseFlows("from,to,amount\na,b,1\n"),
    (e) => e instanceof FlowError && /missing required column 'source'/.test(e.message) &&
      /from, to, amount/.test(e.message)
  );
});

test("parseFlows rejects bad values with line numbers", () => {
  const header = "source,target,value\n";
  assert.throws(() => parseFlows(header + "a,b,abc\n"), /line 2: value 'abc' is not a finite number/);
  assert.throws(() => parseFlows(header + "a,b,\n"), /line 2: value ''/);
  assert.throws(() => parseFlows(header + "a,b,-3\n"), /line 2: value -3 must be >= 0/);
  assert.throws(() => parseFlows(header + "a,b,Infinity\n"), /not a finite number/);
});

test("parseFlows rejects empty names and self-loops", () => {
  const header = "source,target,value\n";
  assert.throws(() => parseFlows(header + ",b,1\n"), /line 2: source and target must be non-empty/);
  assert.throws(() => parseFlows(header + "a,a,1\n"), /line 2: self-loop 'a' → 'a'/);
});

test("parseFlows rejects header-only files", () => {
  assert.throws(() => parseFlows("source,target,value\n"), /no data rows/);
});

test("parseFlows merges duplicate links by summing", () => {
  const { links } = parseFlows(
    "source,target,value\na,b,10\na,b,5\nb,c,2\n"
  );
  assert.equal(links.length, 2);
  const ab = links.find((l) => l.source === "a" && l.target === "b");
  assert.equal(ab.value, 15);
  assert.equal(ab.line, 2); // first occurrence's line is kept
});

test("parseFlows ignores extra columns", () => {
  const { links } = parseFlows(
    "source,target,value,note\na,b,7,hello\n"
  );
  assert.equal(links.length, 1);
  assert.equal(links[0].value, 7);
});
