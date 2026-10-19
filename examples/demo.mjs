#!/usr/bin/env node
/**
 * Deterministic demo for flowdeck. Run: node examples/demo.mjs
 * Writes results/ artifacts and asserts every documented exit code.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLI = path.join(ROOT, "src", "cli.js");
const RESULTS = path.join(ROOT, "results");
fs.mkdirSync(RESULTS, { recursive: true });

let fail = 0;
const check = (label, actual, want) => {
  const ok = actual === want;
  if (!ok) fail = 1;
  console.log(`[${ok ? "ok" : "bad"}] ${label} -> exit ${actual} (want ${want})`);
};

const run = (...args) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });

// 1. Full output set for the traffic example.
let r = run(
  "examples/flows.csv",
  "--svg", "results/flows.svg",
  "--html", "results/flows.html",
  "--json", "results/flows.json",
  "--title", "Site traffic flow"
);
check("flows.csv → svg+html+json", r.status, 0);
process.stdout.write(r.stdout);

// 2. Budget example, cool palette, default svg name is NOT used here.
r = run(
  "examples/spend.csv",
  "--svg", "results/spend.svg",
  "--palette", "cool",
  "--width", "800",
  "--height", "500",
  "--top", "3"
);
check("spend.csv → svg (cool)", r.status, 0);

// 3. No output flags → default <stem>.svg in the current working directory.
const defaultDir = fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMPDIR || ".", "flowdeck-demo-"));
r = spawnSync(process.execPath, [CLI, path.join(ROOT, "examples", "flows.csv"), "--top", "2"], {
  cwd: defaultDir,
  encoding: "utf8",
});
check("default svg name in cwd", r.status, 0);
if (!fs.existsSync(path.join(defaultDir, "flows.svg"))) {
  console.log("[bad] default flows.svg was not written");
  fail = 1;
} else {
  console.log("[ok] default flows.svg written to cwd");
}
fs.rmSync(defaultDir, { recursive: true, force: true });

// 4. Input errors exit 2.
fs.writeFileSync("results/cycle.csv", "a,b,1\nb,c,1\nc,a,1\n");
r = run("results/cycle.csv", "--svg", "results/cycle.svg");
check("cycle graph rejected", r.status, 2);
fs.unlinkSync("results/cycle.csv");

fs.writeFileSync("results/bad.csv", "source,target,value\na,b,not-a-number\n");
r = run("results/bad.csv");
check("bad value rejected", r.status, 2);
fs.unlinkSync("results/bad.csv");

r = run("results/does-not-exist.csv");
check("missing file", r.status, 2);

r = run("--bogus-flag", "examples/flows.csv");
check("unknown flag", r.status, 2);

// 5. Artifacts exist, look like their formats, and are deterministic.
const artifacts = ["results/flows.svg", "results/flows.html", "results/flows.json", "results/spend.svg"];
for (const rel of artifacts) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    console.log(`[bad] missing ${rel}`);
    fail = 1;
    continue;
  }
  const text = fs.readFileSync(p, "utf8");
  const good = rel.endsWith(".svg")
    ? text.startsWith("<svg") && text.includes("</svg>")
    : rel.endsWith(".html")
      ? text.startsWith("<!doctype html>") && text.includes("<svg")
      : Boolean(JSON.parse(text).stats);
  console.log(`[${good ? "ok" : "bad"}] ${rel} (${text.length} bytes)`);
  if (!good) fail = 1;
}

const again = run("examples/flows.csv", "--svg", "results/flows2.svg", "--title", "Site traffic flow");
const same =
  again.status === 0 &&
  fs.readFileSync(path.join(ROOT, "results/flows2.svg"), "utf8") ===
    fs.readFileSync(path.join(ROOT, "results/flows.svg"), "utf8");
console.log(`[${same ? "ok" : "bad"}] byte-identical rerun`);
if (!same) fail = 1;
fs.unlinkSync(path.join(ROOT, "results/flows2.svg"));

console.log(`demo result: ${fail === 0 ? "ALL-OK" : "FAILED"}`);
process.exit(fail);
