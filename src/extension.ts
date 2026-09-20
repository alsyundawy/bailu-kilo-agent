import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { CATALOG, promptFor, Thinking } from "./models";
import { getWebviewHtml } from "./webview";
import { buildSystemPrompt, loadWorkspaceExtras, lookupSkill } from "./skills";
import * as home from "./home";

const SECRET_KEY = "bailu.apiToken";
const MAX_HISTORY = 24;
const FETCH_MS = 600000;
const MAX_ACTIVE_CHARS = 80000;
const MAX_OUT_CAP = 131072;

export interface SettingsMessage {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  thinking?: string;
  locale?: string;
  theme?: string;
  tinyfishApiKey?: string;
}

export interface WebviewMessage extends SettingsMessage {
  type: string;
  mode?: string;
  text?: string;
  query?: string;
  url?: string;
  snapshotId?: string;
}

export function activate(context: vscode.ExtensionContext): void {
  home.ensureHome();
  applyHomeToVscode().catch(() => {
    /* ignore background home synchronization errors */
  });
  const provider = new BailuViewProvider(context);
  context.subscriptions.push(
    provider,
    vscode.window.registerWebviewViewProvider("bailuAgent.sidebar", provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand("bailuAgent.newTask", () => provider.reset()),
    vscode.commands.registerCommand("bailuAgent.openSettings", () => provider.openSettings()),
    vscode.commands.registerCommand("bailuAgent.stop", () => provider.stop()),
    vscode.commands.registerCommand("bailuAgent.exportTranscript", () => provider.exportTranscript()),
    vscode.commands.registerCommand("bailuAgent.saveSnapshot", () => provider.saveSnapshot())
  );
}

export function deactivate(): void {
  /* Cleanup resources on extension deactivation */
}

class BailuViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private settingsPanel?: vscode.WebviewPanel;
  private abort?: AbortController;
  private messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  private streaming = false;

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  dispose(): void {
    this.stop(false);
    this.settingsPanel?.dispose();
    this.settingsPanel = undefined;
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [this.ctx.extensionUri] };
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const csp = `default-src 'none'; img-src ${view.webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    const logoUri = view.webview.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, "media", "logo.svg"));
    view.webview.html = getWebviewHtml(nonce, csp, logoUri.toString());
    view.webview.onDidReceiveMessage((m: WebviewMessage) => this.onMessage(m));
  }

  reset(): void {
    this.stop(false);
    const mode = cfg().get<string>("mode") || "code";
    const locale = cfg().get<string>("locale") === "id" ? "id" : "en";
    const extras = loadWorkspaceExtras();
    this.messages = [{ role: "system", content: buildSystemPrompt(mode, locale, extras, promptFor(mode, locale)) }];
  }

  openSettings(): void {
    this.post({ type: "showSettings" });
    this.openSettingsTab();
  }

  openSettingsTab(): void {
    if (this.settingsPanel) {
      this.settingsPanel.reveal(vscode.ViewColumn.One);
      this.settingsPanel.webview.postMessage({ type: "showSettings" });
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "bailuAgent.settings",
      "Bailu Settings",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [this.ctx.extensionUri] }
    );
    this.settingsPanel = panel;
    panel.onDidDispose(() => {
      if (this.settingsPanel === panel) {
        this.settingsPanel = undefined;
      }
    });
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const csp = `default-src 'none'; img-src ${panel.webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    const logoUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, "media", "logo.svg"));
    panel.webview.html = getWebviewHtml(nonce, csp, logoUri.toString());
    panel.webview.onDidReceiveMessage((m: WebviewMessage) => this.onMessage(m));
    setTimeout(() => {
      panel.webview.postMessage({ type: "showSettings" });
    }, 80);
  }

  showSettings(): void {
    this.openSettings();
  }

  /** Export chat history as a Markdown transcript file (Kilo Code-style). */
  async exportTranscript(): Promise<void> {
    const msgs = this.messages.filter((m) => m.role !== "system");
    if (!msgs.length) {
      vscode.window.showInformationMessage("Bailu Agent: No messages to export.");
      return;
    }
    const lines: string[] = [
      `# Bailu Agent — Chat Transcript`,
      `> Exported: ${new Date().toISOString()}`,
      `> Model: ${cfg().get<string>("model") || "bailu-auto"}`,
      `> Mode: ${cfg().get<string>("mode") || "code"}`,
      ""
    ];
    for (const m of msgs) {
      lines.push(`## ${m.role === "user" ? "👤 User" : "🤖 Bailu"}`, m.content, "");
    }
    const md = lines.join("\n");
    const folders = vscode.workspace.workspaceFolders;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fname = `bailu-transcript-${stamp}.md`;
    if (folders?.length) {
      const uri = vscode.Uri.joinPath(folders[0].uri, fname);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(md, "utf8"));
      await vscode.window.showTextDocument(uri, { preview: false });
      this.post({ type: "status", text: "Transcript exported → " + fname });
    } else {
      /* No workspace — show in untitled editor */
      const doc = await vscode.workspace.openTextDocument({ language: "markdown", content: md });
      await vscode.window.showTextDocument(doc);
      this.post({ type: "status", text: "Transcript opened (no workspace to save)" });
    }
  }

  /** Save a snapshot of the current chat session to ~/.bailucode/snapshots/. */
  async saveSnapshot(): Promise<void> {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const snap = {
      timestamp: new Date().toISOString(),
      model: cfg().get<string>("model") || "bailu-auto",
      mode: cfg().get<string>("mode") || "code",
      messages: this.messages
    };
    const snapDir = home.snapshotDir();
    try {
      fs.mkdirSync(snapDir, { recursive: true });
      const file = path.join(snapDir, `snap-${stamp}.json`);
      fs.writeFileSync(file, JSON.stringify(snap, null, 2), "utf8");
      this.post({ type: "status", text: "Snapshot saved → " + `snap-${stamp}.json` });
      vscode.window.showInformationMessage(`Bailu Agent: Snapshot saved as snap-${stamp}.json`);
    } catch (e) {
      this.post({ type: "error", text: "Snapshot failed: " + err(e) });
    }
  }

  /** Load (restore) a snapshot by ID. */
  async loadSnapshot(id: string): Promise<void> {
    if (!id) return;
    try {
      const safeId = path.basename(id.endsWith(".json") ? id : id + ".json");
      const file = path.join(home.snapshotDir(), safeId);
      if (!fs.existsSync(file)) {
        this.post({ type: "error", text: "Snapshot not found: " + id });
        return;
      }
      const data = JSON.parse(fs.readFileSync(file, "utf8")) as {
        messages?: { role: "system" | "user" | "assistant"; content: string }[];
      };
      if (Array.isArray(data.messages) && data.messages.length) {
        this.messages = data.messages;
        this.post({ type: "status", text: "Snapshot restored: " + id });
        vscode.window.showInformationMessage("Bailu Agent: Snapshot restored.");
      }
    } catch (e) {
      this.post({ type: "error", text: "Load snapshot failed: " + err(e) });
    }
  }

  private async userSearch(q: string): Promise<void> {
    const input = String(q || "").trim();
    if (!input) {
      this.post({ type: "error", text: "Type a query or URL in the box, then press Web." });
      return;
    }

    const targetUrl = extractTargetUrl(input);
    if (targetUrl) {
      this.post({ type: "status", text: "Crawling page via TinyFish…" });
      try {
        const content = await tinyfishFetch(targetUrl);
        this.post({ type: "searchResult", text: `[TinyFish Scraper]\nSource: ${targetUrl}\n\n${content.slice(0, 1200)}...` });
        this.post({ type: "status", text: "Page crawled — asking model" });
        await this.chat(`Scraped content from URL (${targetUrl}):\n\n${content}\n\nAnalyze and summarize the information from this webpage.`);
      } catch (e) {
        this.post({ type: "error", text: err(e) });
      }
      return;
    }

    const query = input.slice(0, 200);
    this.post({ type: "status", text: "Searching web via TinyFish…" });
    try {
      const result = await tinyfishSearch(query);
      this.post({ type: "searchResult", text: result });
      this.post({ type: "status", text: "Search done — asking model" });
      await this.chat("Live web results for: " + query + "\n\n" + result + "\n\nAnswer the query using these results. Cite URLs.");
    } catch (e) {
      this.post({ type: "error", text: err(e) });
    }
  }

  private async toggleBookmark(id: string): Promise<void> {
    const cur = (cfg().get<string[]>("bookmarks") || []).slice();
    const i = cur.indexOf(id);
    if (i >= 0) {
      cur.splice(i, 1);
    } else {
      cur.push(id);
    }
    await cfg().update("bookmarks", cur, vscode.ConfigurationTarget.Global);
    await this.pushInit();
  }

  stop(notify = true): void {
    this.abort?.abort();
    this.abort = undefined;
    this.streaming = false;
    this.post({ type: "done" });
    if (notify) this.post({ type: "status", text: "Stopped" });
  }

  private post(msg: unknown): void {
    this.view?.webview.postMessage(msg);
    this.settingsPanel?.webview.postMessage(msg);
  }

  private async onMessage(m: WebviewMessage): Promise<void> {
    switch (m.type) {
      case "ready":
      case "loadSettings":
        await this.pushInit();
        break;
      case "newTask":
        this.reset();
        break;
      case "setMode":
        if (m.mode && /^[a-z0-9._-]{1,64}$/i.test(m.mode)) {
          await cfg().update("mode", m.mode, vscode.ConfigurationTarget.Global);
          this.reset();
        }
        break;
      case "setModel":
        if (m.model) {
          await cfg().update("model", m.model, vscode.ConfigurationTarget.Global);
          persistHomeFromVscode();
        }
        break;
      case "setThinking":
        if (isThinking(m.thinking)) await cfg().update("thinking", m.thinking, vscode.ConfigurationTarget.Global);
        break;
      case "setLocale":
        if (m.locale === "en" || m.locale === "id") {
          await cfg().update("locale", m.locale, vscode.ConfigurationTarget.Global);
        }
        break;
      case "webSearch":
        await this.userSearch(m.text || m.query || "");
        break;
      case "toggleBookmark":
        await this.toggleBookmark(m.model || cfg().get<string>("model") || "bailu-auto");
        break;
      case "setTheme":
        if (m.theme === "auto" || m.theme === "dark" || m.theme === "light") {
          await cfg().update("theme", m.theme, vscode.ConfigurationTarget.Global);
          persistHomeFromVscode();
        }
        break;
      case "saveSettings":
        await this.saveSettings(m);
        break;
      case "chat":
        await this.chat(m.text || "");
        break;
      case "stop":
        this.stop(true);
        break;
      case "exportTranscript":
        await this.exportTranscript();
        break;
      case "saveSnapshot":
        await this.saveSnapshot();
        break;
      case "loadSnapshot":
        await this.loadSnapshot(m.snapshotId || "");
        break;
      case "openUrl":
        if (m.url && /^https:\/\/alsyundawy\.com\/?$/i.test(m.url)) {
          await vscode.env.openExternal(vscode.Uri.parse("https://alsyundawy.com"));
        }
        break;
    }
  }

  private async pushInit(): Promise<void> {
    const hasKey = !!(await this.ctx.secrets.get(SECRET_KEY));
    const userTinyfish = getUserTinyfishKey();
    const hasTinyfishKey = !!userTinyfish;
    this.post({
      type: "init",
      catalog: CATALOG,
      model: cfg().get<string>("model") || "bailu-auto",
      thinking: cfg().get<string>("thinking") || "high",
      baseUrl: normalizeBase(cfg().get<string>("baseUrl") || ""),
      mode: cfg().get<string>("mode") || "code",
      locale: cfg().get<string>("locale") === "id" ? "id" : "en",
      hasKey,
      hasTinyfishKey,
      extras: loadWorkspaceExtras(),
      bookmarks: cfg().get<string[]>("bookmarks") || ["bailu-auto"],
      theme: cfg().get<string>("theme") || "auto",
      tinyfishApiKey: userTinyfish,
      usage: home.loadUsage(),
      homeDir: home.homeDir(),
      booted: this.messages.length > 0
    });
    if (!this.messages.length) this.reset();
  }

  private async updateApiCredentials(m: SettingsMessage): Promise<void> {
    const rawKey = m.apiKey?.trim();
    if (rawKey && !isMaskedSecret(rawKey)) {
      await this.ctx.secrets.store(SECRET_KEY, rawKey);
    }
    if (m.tinyfishApiKey !== undefined) {
      const rawTf = m.tinyfishApiKey.trim();
      if (!isMaskedSecret(rawTf)) {
        await cfg().update("tinyfishApiKey", rawTf, vscode.ConfigurationTarget.Global);
      }
    }
  }

  private async updateGeneralPreferences(m: SettingsMessage, base: string): Promise<void> {
    if (base) await cfg().update("baseUrl", base, vscode.ConfigurationTarget.Global);
    if (m.model) await cfg().update("model", m.model, vscode.ConfigurationTarget.Global);
    if (isThinking(m.thinking)) await cfg().update("thinking", m.thinking, vscode.ConfigurationTarget.Global);
    if (m.locale === "en" || m.locale === "id") await cfg().update("locale", m.locale, vscode.ConfigurationTarget.Global);
    if (m.theme === "auto" || m.theme === "dark" || m.theme === "light") {
      await cfg().update("theme", m.theme, vscode.ConfigurationTarget.Global);
    }
  }

  private async testConnection(selectedModel?: string): Promise<boolean> {
    try {
      const n = await this.pingModels();
      this.post({ type: "setStatus", text: "Connected. " + n + " model dari API." });
      this.post({ type: "status", text: "Token OK · " + (selectedModel || cfg().get("model")) });
      return true;
    } catch (e) {
      this.post({ type: "setStatus", text: "Test failed: " + err(e) });
      return false;
    }
  }

  private async promptRestartOnSave(connected: boolean): Promise<void> {
    const msg = connected
      ? "Bailu Agent: Settings saved & connection OK. Restart to apply all changes."
      : "Bailu Agent: Settings saved. Restart Extension Host to apply changes.";
    const action = await vscode.window.showInformationMessage(msg, "Restart Extension Host", "Later");
    if (action === "Restart Extension Host") {
      await vscode.commands.executeCommand("workbench.action.restartExtensionHost");
    }
  }

  private async saveSettings(m: SettingsMessage): Promise<void> {
    await this.updateApiCredentials(m);
    const base = normalizeBase(m.baseUrl || "");
    if (base && !isAllowedBase(base)) {
      this.post({ type: "setStatus", text: "Invalid Base URL. Use an http(s) URL." });
      return;
    }
    await this.updateGeneralPreferences(m, base);
    persistHomeFromVscode();
    this.post({ type: "setStatus", text: "Saved. Testing /models …" });
    const connected = await this.testConnection(m.model);
    await this.promptRestartOnSave(connected);
  }


  private async pingModels(): Promise<number> {
    const token = await this.ctx.secrets.get(SECRET_KEY);
    if (!token) throw new Error("Token kosong");
    const base = normalizeBase(cfg().get<string>("baseUrl") || "");
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20000);
    try {
      const res = await fetch(base + "/models", {
        headers: { Authorization: "Bearer " + token, Accept: "application/json" },
        signal: ac.signal
      });
      if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 200));
      const json = (await res.json()) as { data?: { id: string }[] };
      return json.data?.length || 0;
    } finally {
      clearTimeout(t);
    }
  }

  private async chat(text: string): Promise<void> {
    if (this.streaming) return;
    const token = await this.ctx.secrets.get(SECRET_KEY);
    if (!token) {
      this.post({ type: "error", text: "API token is missing. Open Settings." });
      return;
    }
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    /* @skill: mention injection — if message contains @skill:<name>, inject matching skill body */
    const extras = loadWorkspaceExtras();
    const skillMention = /(?:^|\s)@skill:([\w:.-]+)/i.exec(trimmed);
    let enriched = trimmed;
    if (skillMention) {
      const sk = lookupSkill(skillMention[1], extras);
      if (sk) {
        enriched = `[Skill: ${sk.name}]\n${sk.body}\n\n---\n${trimmed}`;
        this.post({ type: "status", text: `@skill:${sk.name} injected` });
      }
    }

    const model = cfg().get<string>("model") || "bailu-auto";
    const thinking = (cfg().get<string>("thinking") || "high") as Thinking;
    const base = normalizeBase(cfg().get<string>("baseUrl") || "");
    if (!isAllowedBase(base)) {
      this.post({ type: "error", text: "Invalid Base URL." });
      return;
    }

    const meta = CATALOG.find((x) => x.id === model);
    if (!this.messages.length) this.reset();
    const contextBlock = await buildEditorContext();
    const userContent = contextBlock ? contextBlock + "\n\n" + enriched : enriched;
    this.messages.push({ role: "user", content: userContent });
    trimHistory(this.messages);


    this.abort?.abort();
    this.abort = new AbortController();
    const timer = setTimeout(() => this.abort?.abort(), FETCH_MS);
    this.streaming = true;
    this.post({ type: "status", text: "Memanggil " + model + "…" });

    const configured = Number(cfg().get("maxTokens") || 0);
    const modelCap = Math.min(meta?.maxOut || 65536, MAX_OUT_CAP);
    const maxOut = configured > 0 ? Math.min(configured, modelCap) : modelCap;
    const effortOk = ["instant", "low", "medium", "high", "max"].includes(thinking) && (meta?.thinking?.includes(thinking) ?? false);
    const body: Record<string, unknown> = {
      model,
      messages: this.messages,
      stream: true,
      max_tokens: maxOut
    };
    if (effortOk) body.reasoning_effort = thinking;

    try {
      await this.executeChatCompletion(base, token, body, model);
    } catch (e) {
      this.handleChatError(e);
    } finally {
      clearTimeout(timer);
      this.streaming = false;
    }
  }

  private async executeChatCompletion(
    base: string,
    token: string,
    body: Record<string, unknown>,
    model: string
  ): Promise<void> {
    let full = await this.streamCompletion(base, token, body, model);
    if (!full) {
      const plain = { model, messages: this.messages, stream: false, max_tokens: Math.min(Number(body.max_tokens) || 8192, MAX_OUT_CAP) };
      full = await this.jsonCompletion(base, token, plain);
      if (full) this.post({ type: "delta", text: full });
    }
    if (full) {
      this.messages.push({ role: "assistant", content: full });
      trimHistory(this.messages);
      const wrote = await applyGeneratedFiles(full);
      if (wrote) this.post({ type: "status", text: model + " · wrote " + wrote + " file(s)" });
    } else {
      this.messages.pop();
      this.post({ type: "error", text: "No text from " + model + ". Try Auto, or another model." });
    }
    this.post({ type: "done" });
    this.post({ type: "status", text: model + " done" });
  }

  private handleChatError(e: unknown): void {
    if ((e as Error)?.name === "AbortError") {
      this.post({ type: "done" });
      this.post({ type: "status", text: "Stopped" });
      return;
    }
    this.post({ type: "error", text: err(e) });
    this.post({ type: "done" });
  }

  private handleSseLine(line: string, model: string): string {
    const s = line.trim();
    if (!s.startsWith("data:")) return "";
    const data = s.slice(5).trim();
    if (!data || data === "[DONE]") return "";
    try {
      const j = JSON.parse(data) as Record<string, unknown>;
      const piece = extractDelta(j);
      if (piece) {
        this.post({ type: "delta", text: piece });
      }
      const used = extractUsage(j);
      if (used) {
        used.last_model = model;
        const snap = home.saveUsage(used);
        this.post({ type: "usage", usage: snap });
      }
      return piece || "";
    } catch {
      /* ignore incomplete SSE JSON chunks */
      return "";
    }
  }

  private async streamCompletion(
    base: string,
    token: string,
    body: Record<string, unknown>,
    model: string
  ): Promise<string> {
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify(body),
      signal: this.abort?.signal
    });
    if (!res.ok || !res.body) {
      const hint = await res.text().catch(() => "");
      throw new Error("HTTP " + res.status + " " + String(hint).slice(0, 280));
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() || "";
      for (const line of parts) {
        full += this.handleSseLine(line, model);
      }
    }
    return full;
  }

  private async jsonCompletion(base: string, token: string, body: Record<string, unknown>): Promise<string> {
    const res = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body),
      signal: this.abort?.signal
    });
    if (!res.ok) {
      const hint = await res.text().catch(() => "");
      throw new Error("HTTP " + res.status + " " + String(hint).slice(0, 280));
    }
    const j = (await res.json()) as Record<string, unknown>;
    return extractMessage(j);
  }
}

function extractDelta(j: Record<string, unknown>): string {
  const choices = j?.choices as { delta?: { content?: unknown; reasoning_content?: unknown } }[] | undefined;
  const d = choices?.[0]?.delta;
  if (!d) return "";
  const raw = d.content;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((p) => {
        if (typeof p === "object" && p) {
          const item = p as { text?: unknown; content?: unknown };
          if (typeof item.text === "string") return item.text;
          if (typeof item.content === "string") return item.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function extractMessage(j: Record<string, unknown>): string {
  const choices = j?.choices as { message?: { content?: unknown } }[] | undefined;
  const m = choices?.[0]?.message;
  if (!m) return "";
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .map((p) => {
        if (typeof p === "object" && p) {
          const item = p as { text?: unknown; content?: unknown };
          if (typeof item.text === "string") return item.text;
          if (typeof item.content === "string") return item.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function extractUsage(j: Record<string, unknown>): Partial<home.UsageData> | null {
  const u = j?.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
  if (!u) return null;
  return {
    prompt_tokens: Number(u.prompt_tokens || 0),
    completion_tokens: Number(u.completion_tokens || 0),
    total_tokens: Number(u.total_tokens || 0)
  };
}

async function applyHomeToVscode(): Promise<void> {
  const h = home.loadHomeConfig();
  const c = cfg();
  const keys = ["baseUrl", "model", "thinking", "mode", "locale", "theme", "tinyfishApiKey"] as const;
  for (const k of keys) {
    const val = h[k];
    if (val != null && c.get(k) !== val) {
      await c.update(k, val, vscode.ConfigurationTarget.Global);
    }
  }
  if (Array.isArray(h.bookmarks)) {
    await c.update("bookmarks", h.bookmarks, vscode.ConfigurationTarget.Global);
  }
}

function persistHomeFromVscode(): void {
  home.saveHomeConfig({
    baseUrl: cfg().get("baseUrl"),
    model: cfg().get("model"),
    thinking: cfg().get("thinking"),
    mode: cfg().get("mode"),
    locale: cfg().get("locale"),
    theme: cfg().get("theme"),
    tinyfishApiKey: getTinyfishKey(),
    bookmarks: cfg().get<string[]>("bookmarks") || []
  });
}

async function buildEditorContext(): Promise<string> {
  const parts: string[] = [];
  const folders = vscode.workspace.workspaceFolders;
  if (folders?.length) {
    const root = folders[0];
    parts.push("Workspace folder: " + root.uri.fsPath);
    try {
      const srcUri = vscode.Uri.joinPath(root.uri, "src");
      const listing = await listShallowSrc(srcUri);
      if (listing.length) parts.push("src/ entries:\n" + listing.map((p) => "- " + p).join("\n"));
    } catch {
      /* no src folder */
    }
  }
  const ed = vscode.window.activeTextEditor;
  if (ed) {
    const rel = folders?.length ? vscode.workspace.asRelativePath(ed.document.uri) : ed.document.fileName;
    let body = ed.document.getText();
    if (body.length > MAX_ACTIVE_CHARS) body = body.slice(0, MAX_ACTIVE_CHARS) + "\n…[truncated]";
    parts.push("Active file: " + rel + "\n```\n" + body + "\n```");
  }
  return parts.length ? "IDE context:\n" + parts.join("\n\n") : "";
}

async function listShallowSrc(dir: vscode.Uri): Promise<string[]> {
  const out: string[] = [];
  let entries: [string, vscode.FileType][] = [];
  try {
    entries = await vscode.workspace.fs.readDirectory(dir);
  } catch {
    return out;
  }
  for (const [name, type] of entries) {
    if (name.startsWith(".")) continue;
    out.push(type === vscode.FileType.Directory ? "src/" + name + "/" : "src/" + name);
    if (out.length >= 80) break;
  }
  return out;
}

async function applyGeneratedFiles(text: string): Promise<number> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return 0;
  const files = parseFenceFiles(text);
  let n = 0;
  for (const f of files) {
    if (!f.path || f.path.includes("..") || f.path.startsWith("/") || f.path.startsWith("\\") || f.path.includes(":")) continue;
    const uri = vscode.Uri.joinPath(folders[0].uri, f.path);
    try {
      const parentUri = vscode.Uri.joinPath(uri, "..");
      await vscode.workspace.fs.createDirectory(parentUri);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(f.body, "utf8"));
      await vscode.window.showTextDocument(uri, { preview: false });
      n += 1;
    } catch {
      /* ignore file write or editor open error */
    }
    if (n >= 20) break;
  }
  return n;
}

function extractFencePath(header: string): string {
  const stripped = header.replace(/^File:\s*/i, "").replace(/^[a-zA-Z0-9_-]+:/, "");
  const tokens = stripped.split(/\s+/);
  const candidate = (tokens.at(-1) || "").replace(/^['"`]|['"`]$/g, "");
  if (candidate?.includes(".") && candidate.length < 200 && !candidate.includes("`")) {
    return candidate;
  }
  return "";
}

function parseFenceFiles(text: string): { path: string; body: string }[] {
  const out: { path: string; body: string }[] = [];
  const lines = String(text || "").split("\n");
  let inFence = false;
  let currentPath = "";
  const currentBody: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("```")) {
      if (inFence) currentBody.push(line);
      continue;
    }
    if (inFence) {
      if (currentPath) {
        out.push({ path: currentPath, body: currentBody.join("\n") });
      }
      inFence = false;
      currentPath = "";
      currentBody.length = 0;
    } else {
      inFence = true;
      currentPath = extractFencePath(trimmed.slice(3).trim());
    }
  }
  return out;
}

function cfg(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("bailu");
}

function normalizeBase(url: string): string {
  let res = String(url || "").trim();
  while (res.endsWith("/")) {
    res = res.slice(0, -1);
  }
  if (res.toLowerCase().endsWith("/chat/completions")) {
    res = res.slice(0, -"/chat/completions".length);
  } else if (res.toLowerCase().endsWith("/models")) {
    res = res.slice(0, -"/models".length);
  } else if (res.toLowerCase().endsWith("/messages")) {
    res = res.slice(0, -"/messages".length);
  }
  while (res.endsWith("/")) {
    res = res.slice(0, -1);
  }
  return res;
}

function isAllowedBase(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function isMaskedSecret(val: string): boolean {
  return val === "••••••••••••••••" || /^•+$/.test(val) || /^\*+$/.test(val);
}

function isThinking(v: string | undefined): v is Thinking {
  return !!v && ["auto", "instant", "low", "medium", "high", "max", "off"].includes(v);
}

function trimHistory(msgs: { role: string; content: string }[]): void {
  if (msgs.length <= MAX_HISTORY) return;
  const sys = msgs[0]?.role === "system" ? [msgs[0]] : [];
  const rest = msgs.slice(sys.length).slice(-(MAX_HISTORY - sys.length));
  msgs.splice(0, msgs.length, ...sys, ...rest);
}

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function parseDdgJson(raw: string): string {
  const j = JSON.parse(raw) as {
    Heading?: string;
    AbstractText?: string;
    AbstractURL?: string;
    RelatedTopics?: { Text?: string; FirstURL?: string }[];
  };
  const lines: string[] = [];
  if (j.Heading || j.AbstractText) {
    lines.push((j.Heading || "Result") + (j.AbstractURL ? " — " + j.AbstractURL : ""));
    if (j.AbstractText) lines.push(j.AbstractText);
  }
  for (const t of j.RelatedTopics || []) {
    if (t?.Text) lines.push("- " + t.Text + (t.FirstURL ? " (" + t.FirstURL + ")" : ""));
    if (lines.length >= 8) break;
  }
  return lines.join("\n");
}

function getUserTinyfishKey(): string {
  const fromCfg = cfg().get<string>("tinyfishApiKey");
  if (fromCfg?.trim()) return fromCfg.trim();
  const fromEnv = process.env.TINYFISH_API_KEY;
  if (fromEnv?.trim()) return fromEnv.trim();
  const fromHome = home.loadHomeConfig().tinyfishApiKey;
  if (typeof fromHome === "string" && fromHome.trim()) return fromHome.trim();
  return "";
}

function getTinyfishKey(): string {
  return getUserTinyfishKey();
}

function extractTargetUrl(input: string): string | null {
  const trimmed = input.trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return trimmed;
  }
  const match = /^(?:scrape|crawl|fetch):\s*(https?:\/\/\S+)/i.exec(trimmed);
  if (match) {
    return match[1];
  }
  return null;
}

function parseTinyfishSearchResults(data: unknown): string {
  const j = data as { results?: { position?: number; title?: string; url?: string; snippet?: string }[] };
  const items = j?.results;
  if (!Array.isArray(items) || !items.length) return "";
  const lines: string[] = [];
  for (let i = 0; i < items.length && i < 6; i++) {
    const item = items[i];
    if (!item?.url) continue;
    const title = item.title ? item.title.trim() : "Result";
    const snippet = item.snippet ? "\n   " + item.snippet.trim() : "";
    lines.push(`${i + 1}. ${title}\n   ${item.url}${snippet}`);
  }
  return lines.join("\n");
}

async function tinyfishSearch(query: string): Promise<string> {
  const key = getTinyfishKey();
  if (key) {
    const url = "https://api.search.tinyfish.ai?query=" + encodeURIComponent(query);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    try {
      const res = await fetch(url, {
        headers: {
          "X-API-Key": key,
          "User-Agent": "Mozilla/5.0 (compatible; BailuAgent/1.1.8)",
          Accept: "application/json"
        },
        signal: ac.signal
      });
      if (!res.ok) throw new Error("TinyFish Search HTTP " + res.status);
      const j = await res.json();
      const formatted = parseTinyfishSearchResults(j);
      if (formatted) return formatted;
    } catch {
      /* fallback to DuckDuckGo */
    } finally {
      clearTimeout(t);
    }
  }
  return ddgSearch(query);
}

function parseTinyfishFetchResults(data: unknown): string {
  const j = data as {
    results?: { title?: string; url?: string; text?: string; description?: string }[];
  };
  const first = j?.results?.[0];
  if (!first?.text) return "";
  const title = first.title ? `# ${first.title}\n\n` : "";
  const desc = first.description ? `> ${first.description}\n\n` : "";
  return (title + desc + first.text).slice(0, 10000);
}

async function tinyfishFetch(targetUrl: string): Promise<string> {
  const key = getTinyfishKey();
  if (key) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 25000);
    try {
      const res = await fetch("https://api.fetch.tinyfish.ai", {
        method: "POST",
        headers: {
          "X-API-Key": key,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; BailuAgent/1.1.8)",
          Accept: "application/json"
        },
        body: JSON.stringify({ urls: [targetUrl] }),
        signal: ac.signal
      });
      if (!res.ok) throw new Error("TinyFish Fetch HTTP " + res.status);
      const j = await res.json();
      const formatted = parseTinyfishFetchResults(j);
      if (formatted) return formatted;
    } catch {
      /* fallback to fetchText + stripHtmlTags */
    } finally {
      clearTimeout(t);
    }
  }

  try {
    const raw = await fetchText(targetUrl, 15000);
    return stripHtmlTags(raw).slice(0, 6000);
  } catch (e) {
    return "Failed to scrape page: " + err(e);
  }
}

async function ddgSearch(query: string): Promise<string> {
  try {
    const lite = await fetchText(
      "https://api.duckduckgo.com/?q=" + encodeURIComponent(query) + "&format=json&no_html=1&skip_disambig=1",
      10000
    );
    const text = parseDdgJson(lite);
    if (text) return text;
  } catch {
    /* ignore json api error and fallback to html */
  }

  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BailuAgent/1.1.8; +https://bailucode.com) AppleWebKit/537.36",
        Accept: "text/html"
      },
      signal: ac.signal
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const html = await res.text();
    return parseDdgHtml(html);
  } finally {
    clearTimeout(t);
  }
}

function stripHtmlTags(html: string): string {
  let res = "";
  let inside = false;
  for (const ch of html) {
    if (ch === "<") {
      inside = true;
      res += " ";
    } else if (ch === ">") {
      inside = false;
    } else if (!inside) {
      res += ch;
    }
  }
  return res.replace(/\s+/g, " ").trim();
}

function extractDdgResult(aTag: string, index: number): string | null {
  const hrefMatch = /href="([^"]+)"/i.exec(aTag);
  if (!hrefMatch) return null;
  let href = hrefMatch[1];
  try {
    const u = new URL(href, "https://html.duckduckgo.com/");
    const uddg = u.searchParams.get("uddg");
    href = uddg ? decodeURIComponent(uddg) : u.toString();
  } catch {
    /* ignore url parse error */
  }
  const title = stripHtmlTags(aTag);
  if (href?.startsWith("http") && title) {
    return `${index}. ${title}\n   ${href}`;
  }
  return null;
}

function parseDdgHtml(html: string): string {
  const out: string[] = [];
  const linkMarker = "result__a";
  let pos = 0;
  while (pos < html.length && out.length < 6) {
    const classIdx = html.indexOf(linkMarker, pos);
    if (classIdx === -1) break;
    const tagStart = html.lastIndexOf("<a", classIdx);
    const tagEnd = html.indexOf("</a>", classIdx);
    if (tagStart === -1 || tagEnd === -1) {
      pos = classIdx + linkMarker.length;
      continue;
    }
    const item = extractDdgResult(html.slice(tagStart, tagEnd + 4), out.length + 1);
    if (item) {
      out.push(item);
    }
    pos = tagEnd + 4;
  }
  return out.join("\n") || "No search results.";
}

async function fetchText(url: string, ms: number): Promise<string> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BailuAgent/1.1.8; +https://bailucode.com) AppleWebKit/537.36", Accept: "application/json,text/html" },
      signal: ac.signal
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}
