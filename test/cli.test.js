import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, VERSION } from "../src/cli.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLI = path.join(ROOT, "src", "cli.js");

function run(...args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "flowdeck-"));
}

test("parseArgs accepts the documented flags", () => {
  const opts = parseArgs([
    "in.csv", "--svg", "o.svg", "--html", "o.html", "--json", "o.json",
    "--title", "T", "--palette", "warm", "--width", "500", "--height", "300",
    "--top", "3",
  ]);
  assert.equal(opts.csv, "in.csv");
  assert.equal(opts.svg, "o.svg");
  assert.equal(opts.html, "o.html");
  assert.equal(opts.json, "o.json");
  assert.equal(opts.title, "T");
  assert.equal(opts.palette, "warm");
  assert.equal(opts.width, 500);
  assert.equal(opts.height, 300);
  assert.equal(opts.top, 3);
});

test("parseArgs rejects bad flags", () => {
  assert.throws(() => parseArgs(["--nope"]), /unknown flag '--nope'/);
  assert.throws(() => parseArgs(["a.csv", "b.csv"]), /extra argument/);
  assert.throws(() => parseArgs(["a.csv", "--svg"]), /requires a value/);
  assert.throws(() => parseArgs(["a.csv", "--width", "0"]), /integer >= 1/);
  assert.throws(() => parseArgs(["a.csv", "--height", "abc"]), /integer >= 1/);
  assert.throws(() => parseArgs(["a.csv", "--top", "-1"]), /integer >= 0/);
});

test("--version and --help exit 0", () => {
  const v = run("--version");
  assert.equal(v.status, 0);
  assert.equal(v.stdout.trim(), `flowdeck ${VERSION}`);
  const h = run("--help");
  assert.equal(h.status, 0);
  assert.ok(h.stdout.includes("usage: flowdeck"));
  assert.ok(h.stdout.includes("exit codes"));
});

test("no arguments exits 2 with a pointer to --help", () => {
  const r = run();
  assert.equal(r.status, 2);
  assert.match(r.stderr, /CSV path is required/);
});

test("full run writes svg + html + json and summarizes", () => {
  const dir = tmpDir();
  const svg = path.join(dir, "out.svg");
  const html = path.join(dir, "out.html");
  const json = path.join(dir, "out.json");
  const r = run(
    "examples/flows.csv",
    "--svg", svg, "--html", html, "--json", json,
    "--title", "Site traffic flow", "--top", "3"
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /graph: 13 nodes, 17 flows, 6 layers, total 28100/);
  assert.equal((r.stdout.match(/  \S+ → \S+/g) || []).length, 3, "top-3 lines");

  const svgText = fs.readFileSync(svg, "utf8");
  assert.ok(svgText.startsWith("<svg"));
  assert.ok(svgText.includes("Site traffic flow"));

  const htmlText = fs.readFileSync(html, "utf8");
  assert.ok(htmlText.startsWith("<!doctype html>"));
  assert.ok(htmlText.includes("<svg"));

  const payload = JSON.parse(fs.readFileSync(json, "utf8"));
  assert.equal(payload.tool, "flowdeck");
  assert.equal(payload.stats.totalValue, 28100);
  assert.equal(payload.topLinks.length, 3);
  assert.equal(payload.topLinks[0].source, "organic-search");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("default svg name lands in cwd when no output flags are given", () => {
  const dir = tmpDir();
  const r = spawnSync(
    process.execPath,
    [CLI, path.join(ROOT, "examples", "flows.csv"), "--top", "2"],
    { cwd: dir, encoding: "utf8" } // relative csv would not resolve from here
  );
  // default behavior with no output flags: write <stem>.svg into cwd
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(dir, "flows.svg")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("missing file exits 2", () => {
  const r = run("no-such-file.csv");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /error:/);
});

test("cycle exits 2 naming the nodes", () => {
  const dir = tmpDir();
  const csv = path.join(dir, "cyc.csv");
  fs.writeFileSync(csv, "source,target,value\na,b,1\nb,c,1\nc,a,1\n");
  const r = run(csv);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /dependency cycle/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("bad values exit 2 with a line number", () => {
  const dir = tmpDir();
  const csv = path.join(dir, "bad.csv");
  fs.writeFileSync(csv, "source,target,value\na,b,oops\n");
  const r = run(csv);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /line 2: value 'oops'/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("unknown flag and unknown palette exit 2", () => {
  assert.equal(run("--bogus", "examples/flows.csv").status, 2);
  const r = run("examples/flows.csv", "--palette", "neon");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown palette/);
});

test("invalid sizes exit 2", () => {
  const r = run("examples/flows.csv", "--width", "x");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--width must be an integer/);
});

test("runs are deterministic (identical svg bytes)", () => {
  const dir = tmpDir();
  const a = path.join(dir, "a.svg");
  const b = path.join(dir, "b.svg");
  assert.equal(run("examples/spend.csv", "--svg", a).status, 0);
  assert.equal(run("examples/spend.csv", "--svg", b).status, 0);
  assert.equal(
    fs.readFileSync(a, "utf8"),
    fs.readFileSync(b, "utf8")
  );
  fs.rmSync(dir, { recursive: true, force: true });
});
