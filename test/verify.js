const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");

function check(file) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
}

[
  "out/extension.js",
  "out/webview.js",
  "out/models.js",
  "out/skills.js",
  "out/home.js",
].forEach((f) => {
  const p = path.join(root, f);
  assert.ok(fs.existsSync(p), "missing " + f);
  check(p);
});

const webview = require(path.join(root, "out/webview.js"));
const html = webview.getWebviewHtml(
  "n0nce",
  "default-src 'none'",
  "vscode-resource://logo.svg",
);
assert.ok(html.startsWith("<!DOCTYPE html>"), "html start");
assert.ok(html.includes("acquireVsCodeApi"), "webview api");
assert.ok(html.includes('id="btnSend"'), "send button");
assert.ok(html.includes('id="model"'), "model select");
assert.ok(
  !html.includes("${") || html.includes("nonce"),
  "template interpolations resolved except documented",
);

const orig = Module._load;
Module._load = (req, parent, isMain) => {
  if (req === "vscode") {
    return {
      window: { registerWebviewViewProvider: () => ({ dispose() {} }) },
      commands: { registerCommand: () => ({ dispose() {} }) },
      workspace: {
        workspaceFolders: null,
        getConfiguration: () => ({
          get: () => undefined,
          update: () => Promise.resolve(),
        }),
      },
      Uri: { joinPath: () => ({}) },
      ConfigurationTarget: { Global: 1 },
    };
  }
  return orig(req, parent, isMain);
};

const ext = require(path.join(root, "out/extension.js"));
assert.strictEqual(typeof ext.activate, "function");
const subs = [];
ext.activate({
  subscriptions: subs,
  secrets: { get: async () => undefined, store: async () => {} },
  extensionUri: { fsPath: root },
});
assert.ok(subs.length >= 1, "subscriptions registered");

const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
assert.strictEqual(pkg.version, "1.1.9");
assert.strictEqual(
  pkg.contributes.viewsContainers.activitybar[0].icon,
  "media/activity.svg",
);
assert.ok(fs.existsSync(path.join(root, "out/home.js")));
assert.ok(html.includes("ALSYUNDAWY IT SOLUTION"));
assert.ok(pkg.author?.email === "alsyundawy@gmail.com");
assert.ok(html.includes("btnWeb"));
assert.ok(html.includes("btnStar"));
assert.ok(html.includes('id="theme"'));
const { CATALOG } = require(path.join(root, "out/models.js"));
assert.ok(CATALOG.length >= 38, "expanded model catalog with 38+ models");
assert.ok(
  CATALOG.some((m) => m.id === "bailu-2.8"),
  "bailu-2.8 present",
);
assert.ok(
  CATALOG.some((m) => m.id === "bailu-apex-openclaw"),
  "bailu-apex-openclaw present",
);
assert.ok(
  CATALOG.some((m) => m.id === "bailu-2.8-nvfp8"),
  "bailu-2.8-nvfp8 present",
);
assert.ok(
  CATALOG.some((m) => m.id === "bailu-turing"),
  "bailu-turing present",
);

assert.ok(html.includes('id="modelBadgeBar"'), "model badge bar present");
assert.ok(html.includes('id="btnStop"'), "stop button present");
assert.ok(html.includes("updateModelBadges"), "update badges script present");
assert.ok(html.includes("setBusy"), "setBusy toggle script present");
assert.ok(html.includes("code-copy"), "code copy script present");

const thinkEnum =
  pkg.contributes.configuration.properties["bailu.thinking"].enum;
assert.ok(
  thinkEnum.includes("instant") &&
    thinkEnum.includes("max") &&
    thinkEnum.includes("off"),
  "thinking enum coverage",
);

const extSrc = fs.readFileSync(path.join(root, "out/extension.js"), "utf8");
assert.ok(
  !extSrc.includes('require("./webtools")'),
  "must not load broken webtools module",
);

console.log("verify ok");
