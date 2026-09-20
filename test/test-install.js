"use strict";
const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const Module = require("node:module");

const root = path.join(__dirname, "..");
const vsixName = "bailu-kilo-agent-1.1.8.vsix";
const vsixPath = path.join(root, vsixName);

const UNZIP_BIN = fs.existsSync("/usr/bin/unzip") ? "/usr/bin/unzip" : "unzip";
const TAR_BIN = fs.existsSync("/usr/bin/tar") ? "/usr/bin/tar" : "tar";
const NPM_BIN = fs.existsSync("/usr/local/bin/npm") ? "/usr/local/bin/npm" : (fs.existsSync("/usr/bin/npm") ? "/usr/bin/npm" : "npm");
const SECURE_ENV = {
  ...process.env,
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin"
};

console.log(`[TEST-INSTALL] Verifying VSIX package: ${vsixName}`);

// 1. Ensure VSIX exists
if (!fs.existsSync(vsixPath)) {
  console.log("[TEST-INSTALL] VSIX not found, running build & package first...");
  execFileSync(NPM_BIN, ["run", "compile"], { cwd: root, stdio: "inherit", env: SECURE_ENV });
  execFileSync(NPM_BIN, ["run", "package"], { cwd: root, stdio: "inherit", env: SECURE_ENV });
}

assert.ok(fs.existsSync(vsixPath), `VSIX package ${vsixName} must exist`);
const vsixStats = fs.statSync(vsixPath);
assert.ok(vsixStats.size > 20000, `VSIX package size (${vsixStats.size} bytes) looks too small`);
console.log(`[TEST-INSTALL] VSIX exists, size: ${(vsixStats.size / 1024).toFixed(2)} KB`);

// 2. Test ZIP archive integrity and inspect file listing
let fileList = "";
try {
  fileList = execFileSync(UNZIP_BIN, ["-Z", "-1", vsixPath], { encoding: "utf8", env: SECURE_ENV });
} catch {
  // Fallback to tar if unzip -Z not supported
  fileList = execFileSync(TAR_BIN, ["-tf", vsixPath], { encoding: "utf8", env: SECURE_ENV });
}

const files = fileList.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

console.log(`[TEST-INSTALL] Package contains ${files.length} files.`);

// 3. Verify mandatory files inside VSIX
const mandatory = [
  "extension/package.json",
  "extension/out/extension.js",
  "extension/out/webview.js",
  "extension/out/models.js",
  "extension/out/skills.js",
  "extension/out/home.js",
  "extension/media/activity.svg",
  "extension/media/icon.png",
  "extension/README.md",
  "extension/CHANGELOG.md",
  "extension/DOCNOTE.md",
  "extension/AUTHOR.md",
  "extension/LICENSE"
];

for (const m of mandatory) {
  const found = files.some((f) => f.toLowerCase() === m.toLowerCase() || (m.endsWith("LICENSE") && f.startsWith("extension/LICENSE")));
  assert.ok(
    found,
    `[TEST-INSTALL] Mandatory file missing from VSIX: ${m}`
  );
}

// 4. Verify exclusions (no src, no tests, no ts files in root, no git, no node_modules)
const forbiddenPrefixes = [
  "extension/src/",
  "extension/test/",
  "extension/node_modules/",
  "extension/.git/",
  "extension/.vscode/"
];

for (const f of files) {
  for (const prefix of forbiddenPrefixes) {
    assert.ok(
      !f.startsWith(prefix),
      `[TEST-INSTALL] Forbidden file leaked into VSIX: ${f}`
    );
  }
  if (f.endsWith(".ts") && !f.endsWith(".d.ts")) {
    assert.fail(`[TEST-INSTALL] TypeScript source file leaked into VSIX: ${f}`);
  }
}
console.log("[TEST-INSTALL] Exclusion check PASSED (clean packaging, zero source leaks).");

// 5. Simulate Installation by extracting into temporary VS Code extension folder
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-test-install-"));
console.log(`[TEST-INSTALL] Extracting to simulated extension host location: ${tmpDir}`);

try {
  execFileSync(UNZIP_BIN, ["-q", vsixPath, "-d", tmpDir], { stdio: "pipe", env: SECURE_ENV });
} catch {
  execFileSync(TAR_BIN, ["-xf", vsixPath, "-C", tmpDir], { stdio: "pipe", env: SECURE_ENV });
}

const installedExtDir = path.join(tmpDir, "extension");
assert.ok(fs.existsSync(installedExtDir), "Extracted 'extension' folder must exist");

// 6. Inspect installed package.json
const installedPkg = JSON.parse(fs.readFileSync(path.join(installedExtDir, "package.json"), "utf8"));
assert.strictEqual(installedPkg.name, "bailu-kilo-agent");
assert.strictEqual(installedPkg.version, "1.1.8");
assert.strictEqual(installedPkg.main, "./out/extension.js");
assert.strictEqual(installedPkg.engines?.vscode, "^1.90.0");
assert.ok(Array.isArray(installedPkg.activationEvents), "activationEvents must be an array");
assert.ok(installedPkg.contributes?.views?.bailuAgent?.some((v) => v.id === "bailuAgent.sidebar"), "sidebar view contributed");
assert.ok(installedPkg.contributes?.viewsContainers?.activitybar?.some((v) => v.id === "bailuAgent"), "activitybar container contributed");

console.log("[TEST-INSTALL] Installed package manifest verification PASSED.");

// 7. Simulate VS Code Extension Host loading and activation
const commandsRegistered = new Map();
let webviewProviderRegistered = null;

const mockVscode = {
  window: {
    registerWebviewViewProvider: (viewId, provider, options) => {
      webviewProviderRegistered = { viewId, provider, options };
      return { dispose() { webviewProviderRegistered = null; } };
    },
    createWebviewPanel: (id, title, col, opt) => ({
      webview: {
        asWebviewUri: (u) => `vscode-webview://${u.path || u}`,
        cspSource: "vscode-webview:",
        html: "",
        postMessage: () => Promise.resolve(true),
        onDidReceiveMessage: () => ({ dispose() {} })
      },
      reveal: () => {},
      onDidDispose: () => ({ dispose() {} }),
      dispose: () => {}
    }),
    showInformationMessage: (msg) => { console.log(`  [VSCode Info] ${msg}`); return Promise.resolve(); },
    showErrorMessage: (msg) => { console.log(`  [VSCode Error] ${msg}`); return Promise.resolve(); },
    showTextDocument: () => Promise.resolve()
  },
  commands: {
    registerCommand: (cmd, handler) => {
      commandsRegistered.set(cmd, handler);
      return {
        dispose() { commandsRegistered.delete(cmd); }
      };
    }
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: root } }],
    getConfiguration: (section) => {
      const store = {
        baseUrl: "https://bailucode.com/openapi/v1",
        model: "bailu-auto",
        thinking: "high",
        mode: "code",
        locale: "en",
        theme: "auto",
        bookmarks: ["bailu-auto"],
        maxTokens: 0,
        tinyfishApiKey: ""
      };
      return {
        get: (key) => store[key],
        update: (key, val) => { store[key] = val; return Promise.resolve(); }
      };
    },
    openTextDocument: () => Promise.resolve({}),
    fs: {
      writeFile: () => Promise.resolve()
    }
  },
  Uri: {
    file: (p) => ({ fsPath: p, path: p, scheme: "file" }),
    joinPath: (base, ...segs) => ({ fsPath: path.join(base.fsPath || base, ...segs), path: path.join(base.fsPath || base, ...segs) }),
    parse: (u) => ({ toString: () => u })
  },
  env: {
    openExternal: () => Promise.resolve(true)
  },
  ConfigurationTarget: { Global: 1, Workspace: 2 },
  ViewColumn: { One: 1, Two: 2 }
};

// Hook require("vscode") for the installed module
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "vscode") {
    return mockVscode;
  }
  return origLoad(request, parent, isMain);
};

const installedExtEntry = path.join(installedExtDir, "out", "extension.js");
assert.ok(fs.existsSync(installedExtEntry), `Entry point ${installedExtEntry} must exist`);

const extModule = require(installedExtEntry);
assert.strictEqual(typeof extModule.activate, "function", "ext.activate must be a function");
assert.strictEqual(typeof extModule.deactivate, "function", "ext.deactivate must be a function");

const mockSubscriptions = [];
const mockContext = {
  subscriptions: mockSubscriptions,
  secrets: {
    get: async () => "mock-secret-token",
    store: async () => {},
    delete: async () => {}
  },
  extensionUri: { fsPath: installedExtDir },
  globalState: { get: () => undefined, update: () => Promise.resolve() },
  workspaceState: { get: () => undefined, update: () => Promise.resolve() }
};

// Execute activate()
extModule.activate(mockContext);

console.log(`[TEST-INSTALL] activate() completed successfully.`);
console.log(`[TEST-INSTALL] Subscriptions registered: ${mockSubscriptions.length}`);
assert.ok(mockSubscriptions.length >= 6, "Expected at least 6 subscriptions (provider, view registration, 5 commands)");

// Verify Webview View Provider
assert.ok(webviewProviderRegistered, "WebviewViewProvider must be registered");
assert.strictEqual(webviewProviderRegistered.viewId, "bailuAgent.sidebar");

// Verify Commands
const expectedCommands = [
  "bailuAgent.newTask",
  "bailuAgent.openSettings",
  "bailuAgent.stop",
  "bailuAgent.exportTranscript",
  "bailuAgent.saveSnapshot"
];

for (const cmd of expectedCommands) {
  assert.ok(commandsRegistered.has(cmd), `Command ${cmd} must be registered`);
}
console.log(`[TEST-INSTALL] All ${expectedCommands.length} commands verified.`);

// Test executing a command handler
const newTaskHandler = commandsRegistered.get("bailuAgent.newTask");
assert.doesNotThrow(() => newTaskHandler(), "bailuAgent.newTask handler must not throw");

const stopHandler = commandsRegistered.get("bailuAgent.stop");
assert.doesNotThrow(() => stopHandler(), "bailuAgent.stop handler must not throw");

// Simulate Webview resolution
let receivedMessages = [];
const mockWebviewView = {
  webview: {
    options: {},
    html: "",
    cspSource: "vscode-webview:",
    asWebviewUri: (u) => `vscode-webview://${u.path || u.fsPath || u}`,
    onDidReceiveMessage: (handler) => {
      // Simulate ready message
      handler({ type: "ready" });
      return { dispose() {} };
    },
    postMessage: (msg) => {
      receivedMessages.push(msg);
      return Promise.resolve(true);
    }
  }
};

async function runSimulation() {
  webviewProviderRegistered.provider.resolveWebviewView(mockWebviewView);
  assert.ok(mockWebviewView.webview.html.length > 500, "Webview HTML must be populated");
  assert.ok(mockWebviewView.webview.html.includes("<!DOCTYPE html>"), "Webview HTML valid structure");
  assert.ok(mockWebviewView.webview.html.includes("Bailu Agent"), "Webview contains Bailu Agent");
  assert.ok(mockWebviewView.webview.html.includes("ALSYUNDAWY IT SOLUTION"), "Webview contains branding");
  assert.ok(mockWebviewView.webview.html.includes('id="modelBadgeBar"'), "Webview contains model badge bar");

  // Wait for async message loop (pushInit)
  await new Promise((r) => setTimeout(r, 80));

  // Verify that init message was posted to the webview
  const initMsg = receivedMessages.find((m) => m.type === "init");
  assert.ok(initMsg, "Expected webview to receive init message");
  assert.strictEqual(initMsg.model, "bailu-auto");
  assert.ok(Array.isArray(initMsg.catalog) && initMsg.catalog.length >= 38, "Init message includes 38+ models catalog");

  // Verify models.js in extracted directory
  const installedModels = require(path.join(installedExtDir, "out", "models.js"));
  assert.ok(installedModels.CATALOG.length >= 38, "Catalog must contain 38 models");
  assert.ok(installedModels.CATALOG.some((m) => m.id === "bailu-2.8"), "bailu-2.8 model verified");
  assert.ok(installedModels.CATALOG.some((m) => m.id === "bailu-apex-openclaw"), "bailu-apex-openclaw model verified");

  // Test clean deactivation
  assert.doesNotThrow(() => extModule.deactivate(), "deactivate() must not throw");

  // Clean up Module._load hook
  Module._load = origLoad;

  // Clean up temporary extracted directory
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log("[TEST-INSTALL] Simulated installation & extension lifecycle test PASSED successfully!");
}

runSimulation().catch((err) => {
  console.error(err);
  process.exit(1);
});
