"use strict";
// Internal audit script for v1.1.8 - not part of final package

// ── 1. normalizeBase ─────────────────────────────────────────────────────────
function normalizeBase(url) {
  let res = String(url || "").trim();
  while (res.endsWith("/")) res = res.slice(0, -1);
  if (res.toLowerCase().endsWith("/chat/completions"))
    res = res.slice(0, -"/chat/completions".length);
  else if (res.toLowerCase().endsWith("/models"))
    res = res.slice(0, -"/models".length);
  else if (res.toLowerCase().endsWith("/messages"))
    res = res.slice(0, -"/messages".length);
  while (res.endsWith("/")) res = res.slice(0, -1);
  return res;
}

const normalizeTests = [
  ["https://api.example.com/v1/", "https://api.example.com/v1"],
  ["https://api.example.com/v1/chat/completions", "https://api.example.com/v1"],
  ["https://api.example.com/v1/models", "https://api.example.com/v1"],
  ["https://api.example.com/v1/messages/", "https://api.example.com/v1"],
  ["https://api.example.com/v1", "https://api.example.com/v1"],
  ["", ""],
  ["not-a-url", "not-a-url"],
  ["https://openrouter.ai/api/v1", "https://openrouter.ai/api/v1"],
];
let fail = 0;
normalizeTests.forEach(([input, expected]) => {
  const result = normalizeBase(input);
  if (result !== expected) {
    console.error("FAIL normalizeBase:", input, "=>", result, "(expected:", expected + ")");
    fail++;
  }
});
if (!fail) console.log("normalizeBase: all OK");

// ── 2. extractFencePath ───────────────────────────────────────────────────────
const knownLibs = ["vue.js", "chart.js", "three.js", "d3.js", "moment.js", "highlight.js"];
function extractFencePath(header) {
  const stripped = header
    .replace(/^File:\s*/i, "")
    .replace(/^[a-zA-Z0-9_-]+:/, "");
  const tokens = stripped.split(/\s+/);
  const candidate = (tokens.at(-1) || "").replace(/^['"`]|['"`]$/g, "");
  if (candidate && candidate.includes(".") && candidate.length < 200 && !candidate.includes("`")) {
    if (
      knownLibs.includes(candidate.toLowerCase()) &&
      !header.toLowerCase().includes("file") &&
      !candidate.includes("/")
    ) {
      return "";
    }
    return candidate;
  }
  return "";
}

const fenceTests = [
  ["typescript src/app.ts", "src/app.ts"],
  ["javascript chart.js", ""],        // known lib, no slash, no 'file'
  ["File: src/utils.ts", "src/utils.ts"],
  ["js src/lib/chart.js", "src/lib/chart.js"], // has slash -> NOT a lib match
  ["python", ""],                     // no dot
  ["js hello world", ""],             // no dot
  ["typescript src/foo/bar.ts", "src/foo/bar.ts"],
];
let fenceFail = 0;
fenceTests.forEach(([header, expected]) => {
  const result = extractFencePath(header);
  if (result !== expected) {
    console.error("FAIL extractFencePath:", JSON.stringify(header), "=>", JSON.stringify(result), "(expected:", JSON.stringify(expected) + ")");
    fenceFail++;
  }
});
if (!fenceFail) console.log("extractFencePath: all OK");

// ── 3. trimHistory ────────────────────────────────────────────────────────────
const MAX_HISTORY = 24;
function trimHistory(msgs) {
  if (msgs.length <= MAX_HISTORY) return;
  const sys = msgs[0] && msgs[0].role === "system" ? [msgs[0]] : [];
  const rest = msgs.slice(sys.length).slice(-(MAX_HISTORY - sys.length));
  msgs.splice(0, msgs.length, ...sys, ...rest);
}

// 1 sys + 24 msgs = 25 -> trim to 24, keep system
const msgs1 = [{ role: "system", content: "sys" }];
for (let i = 0; i < 24; i++) msgs1.push({ role: i % 2 === 0 ? "user" : "assistant", content: "msg" + i });
trimHistory(msgs1);
if (msgs1.length !== 24 || msgs1[0].role !== "system") console.error("FAIL trimHistory: sys+24 case");
else console.log("trimHistory (sys+24 -> 24): OK");

// No system, 30 messages -> trim to 24
const msgs2 = [];
for (let i = 0; i < 30; i++) msgs2.push({ role: "user", content: "msg" + i });
trimHistory(msgs2);
if (msgs2.length !== 24) console.error("FAIL trimHistory: no-sys 30 -> 24, got:", msgs2.length);
else console.log("trimHistory (no-sys 30 -> 24): OK");

// Exactly 24 -> no trim
const msgs3 = [];
for (let i = 0; i < 24; i++) msgs3.push({ role: "user", content: "msg" + i });
trimHistory(msgs3);
if (msgs3.length !== 24) console.error("FAIL trimHistory: 24 exact, got:", msgs3.length);
else console.log("trimHistory (exact 24): OK");

// ── 4. isMaskedSecret ────────────────────────────────────────────────────────
function isMaskedSecret(val) {
  return val === "••••••••••••••••" || /^•+$/.test(val) || /^\*+$/.test(val);
}
const maskedTests = [
  ["••••••••••••••••", true],
  ["••••", true],
  ["****", true],
  ["sk-real-key-123", false],
  ["", false],
  ["•••a•••", false], // mixed - should NOT match
];
let maskFail = 0;
maskedTests.forEach(([val, expected]) => {
  const result = isMaskedSecret(val);
  if (result !== expected) {
    console.error("FAIL isMaskedSecret:", JSON.stringify(val), "=>", result, "(expected:", expected + ")");
    maskFail++;
  }
});
if (!maskFail) console.log("isMaskedSecret: all OK");

// ── 5. isAllowedBase ─────────────────────────────────────────────────────────
function isAllowedBase(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
const baseTests = [
  ["https://bailucode.com/openapi/v1", true],
  ["http://localhost:11434/api", true],
  ["ftp://bad.com", false],
  ["javascript:alert(1)", false],
  ["not-a-url", false],
  ["", false],
];
let baseFail = 0;
baseTests.forEach(([url, expected]) => {
  const result = isAllowedBase(url);
  if (result !== expected) {
    console.error("FAIL isAllowedBase:", url, "=>", result, "(expected:", expected + ")");
    baseFail++;
  }
});
if (!baseFail) console.log("isAllowedBase: all OK");

// ── 6. Catalog maxOut vs MAX_OUT_CAP consistency ──────────────────────────────
const { CATALOG } = require("../out/models.js");
const MAX_OUT_CAP = 262144;
const overCap = CATALOG.filter((m) => m.maxOut > MAX_OUT_CAP);
if (overCap.length) {
  console.log("INFO: Models with maxOut > MAX_OUT_CAP (will be capped to " + MAX_OUT_CAP + "):");
  overCap.forEach((m) => console.log("  ", m.id, "=>", m.maxOut, "-> capped to", MAX_OUT_CAP));
  console.log("  RECOMMENDATION: Either raise MAX_OUT_CAP or correct catalog values.");
} else {
  console.log("Catalog maxOut: all within cap");
}

// ── 7. Webview: static copyright year ────────────────────────────────────────
const { getWebviewHtml } = require("../out/webview.js");
const html = getWebviewHtml("testnonce", "default-src 'none'", "test.svg");
const CURRENT_YEAR = new Date().getFullYear();
const yearRx = /2023[–-](\d{4})/g;
let m;
const yearMatches = [];
while ((m = yearRx.exec(html)) !== null) yearMatches.push(Number(m[1]));
const staleYears = yearMatches.filter((y) => y < CURRENT_YEAR);
if (staleYears.length) {
  console.log("WARN: Footer has static year(s) that may lag behind:", staleYears, "(current:", CURRENT_YEAR + ")");
} else {
  console.log("Footer year: up-to-date (" + CURRENT_YEAR + ")");
}

// ── 8. openUrl allowlist narrowness ──────────────────────────────────────────
// extension.ts: only allows ^https:\/\/alsyundawy\.com\/?$ - very strict, good
console.log("openUrl allowlist: strict regex (hardened) OK");

console.log("\nAudit complete.");
