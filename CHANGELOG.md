# Changelog

All notable changes to **Bailu Agent** are documented in this file.

## [1.1.9] — GUI Modernization, 39-Model Catalog & Mandatory Restart Protocol

> **TypeScript compile**: `tsc 5.x` · **VSCode Engine**: `^1.90.0` · **Node**: `≥ 18`

### ✨ New Features

- **39 Live AI Models — Enterprise `bailu-turing` Added**: Synchronized the enterprise flagship model `bailu-turing` (BaiLu Turing, Enterprise Deep Reasoning Flagship: 1,048,576 token context, 131,072 max output, multimodal vision + deep reasoning) from the live Bailu AI dashboard. The verified AI catalog now reaches 39 models including `bailu-2.8`, `bailu-apex-2.7`, `bailu-apex-openclaw`, and `bailu-turing`.
- **Comprehensive GUI & UX Modernization (Kilo Style)**:
  - **Codicon-Style Crisp Inline SVGs**: Replaced all legacy OS emoji action icons (`📄`, `📷`, `＋`, `⚙`, `←`) with modern, crisp, developer-oriented inline SVG codicons consistent across VS Code Dark, Light, and High-Contrast themes.
  - **Welcome Card & Quick Action Starters** (`#welcomeCard`): An interactive card with 4 one-click prompt starters (`💡 Explain active file`, `✨ Refactor & clean`, `🧪 Generate unit tests`, `🔍 Debug & find bugs`) visible when the chat is empty, automatically dismissed once a conversation begins.
  - **Sharper Message Bubble Hierarchy**: High-contrast separation between user messages (`.msg.user` with semi-transparent theme accent and `👤 You` badge) and assistant replies (`.msg.assistant` with `🤖 Bailu` badge and SVG copy button). Dramatically improves readability on narrow sidebars (250–300px).
  - **Live Streaming Typing Indicator**: Active cursor `▍` with `@keyframes blinkCursor` animation during SSE token reception (`data-stream="1"`), giving instant visual feedback that the model is composing a reply.
  - **Pulsing Status Indicator** (`#statusDot`): Glowing green dot (`.dot-ready`) when idle; pulsing amber/blue dot (`.dot-busy`) while processing. Dynamic `title` tooltip: `"Model is generating…"` or `"Ready — type to chat"`.
  - **Structured Settings Cards** (`.setting-group`): Authentication & Keys, Model & Reasoning Defaults, Preferences, and Telemetry & Usage — each in a clean categorized card.
  - **Adaptive Thinking Selector**: `.no-think` styling dims reasoning intensity controls when the active model does not support reasoning parameters.
- **Mandatory Extension Restart Prompt on Install / Update / Reinstall**: `checkInstallOrUpdateRestart()` in `src/extension.ts` detects every fresh install, version upgrade, update, re-install, or new download and automatically prompts the user to **Restart Extension Host** (`workbench.action.restartExtensionHost`) or **Reload Window** (`workbench.action.reloadWindow`). Guarantees zero stale state, fresh `SecretStorage` keychain access, and immediate sidebar activation.

### 🐛 Bug Fixes

- **SSE TextDecoder Final-Flush Bug**: API servers terminating streaming without a trailing newline left the final chunk trapped in the buffer. Fixed by executing a parameterless `dec.decode()` flush after the stream reader loop completes.
- **`reasoning_effort` Dropped on Streaming Fallback**: When streaming encountered network disruptions or 503 errors, the non-streaming fallback silently dropped `reasoning_effort`. Now `body.reasoning_effort` is fully preserved in all fallback payloads.
- **`MAX_OUT_CAP` vs Catalog `maxOut` Discrepancy**: Models with up to 256K output capacity were capped by an artificial 128K ceiling. Raised to `262144` (256K) and updated `bailu.maxTokens` configuration boundaries accordingly.
- **Catalog `maxOut` Alignment** (`bailu-apex-2.7`, `bailu-apex`): Corrected `maxOut` from `512000` to `262144` (= `MAX_OUT_CAP`). Previously badges displayed `512K out` which runtime silently overrode, misleading users.
- **Accessibility `setBusy()` Textarea Guard**: Added `aria-disabled="true"` and `readonly` to `#input` while streaming; removed on idle. Prevents typing while busy and correctly communicates state to screen readers.
- **Sandboxed & Read-Only Environment Resilience**: Wrapped `writeJson()` in `src/home.ts` with `try/catch` to prevent unhandled I/O exceptions in Docker containers, Nix environments, and read-only remote workspaces.
- **Linter & Code Hygiene** (`src/webtools.ts`): Fixed regex loop assignment (`while (m !== null)`) for 100% compliance with Biome linter under `trunk check`.
- **User-Agent & Version Sync**: Harmonized `USER_AGENT` and `EXTENSION_VERSION` constants to always reflect the active release (`BailuAgent/1.1.9`).
- **100% English System Messages & Localization**: Replaced all remaining non-English backend strings in `src/extension.ts` (`"Token kosong"` → `"API token is missing"`, `"Memanggil "` → `"Calling "`, `"model dari API"` → `"models from API"`).

### 🔧 Chores & Verification

- **Comprehensive Audit & Verification Suite**: Updated `test/verify.js` and `test/audit.js` covering URL normalization, token isolation, model catalog validation, output cap enforcement, and zero-source-leak packaging checks.
- **Production VSIX Artifact**: `bailu-kilo-agent-1.1.9.vsix` — Universal build (VS Code, Code-OSS, VSCodium, Cursor, Windsurf, Trae, Antigravity-IDE), 25 files, zero source code or test directory leaks.

---

## [1.1.8] — Modernized Kilo Sidebar, Live 38-Model Catalog & Deep Reasoning Engine

### ✨ New Features

- **Model Catalog Alignment (38 Models)**: Full synchronization with the live Bailu dashboard. Added flagship model `bailu-2.8` (Claude Opus 5 Tier, 1M context, 131K output), `bailu-2.8-nvfp8`, `bailu-2.8-lite` (MoE), `bailu-2.8-free`, `bailu-apex-openclaw` (agent workflow & tool use), multimodal/vision variants (`bailu-2.8-vl-2B`, `bailu-2.7-lite-vl`, `bailu-2.7-vl-350m`), and edge models (`bailu-edge-8b`, `bailu-edge-0.5b`).
- **Model Badges Property Mapping**: Fixed badge property mappings (`.context` & `.maxOut`) to align with the `CatalogModel` interface and webview DOM. All models accurately display capacity badges (`1M ctx`, `131K out`, `262K ctx`, `218K out`).
- **Thinking Levels Support** (`instant`, `max`, `off`): Expanded thinking level options for advanced reasoning models (`bailu-2.8`, `bailu-apex-2.7`, `bailu-2.7-lite`). Fixed backend validation so `instant` and `max` are forwarded accurately to the API.
- **GUI UX Overhaul — Model Specs & Capability Badges Bar** (`#modelBadgeBar`): Real-time dynamic pill badges for context length, max output tokens, and capability tags (`Opus 5 Tier`, `Vision`, `Free`, `NVFP8`, `MoE`, `Edge`).
- **GUI UX Overhaul — Code Block Language Header & Dedicated Copy**: Fenced code blocks in Markdown feature language header bars and isolated copy buttons (`.code-copy`) with CSP-safe `✓` confirmation animations.
- **GUI UX Overhaul — Dynamic Send / Stop Button Toggle**: Automatically toggles between Send and Stop buttons to maximize space on compact VS Code sidebars.
- **GUI UX Overhaul — Auto-Expanding Chat Input**: Textarea dynamically expands up to 200px when typing long prompts or pasting multi-line code.
- **GUI UX Overhaul — Responsive Agent Modes Grid**: Agent mode tabs (`Code`, `Plan`, `Ask`, `Debug`, `Review`, `Arch`) organized with responsive CSS Grid (`minmax(42px, 1fr)`).

### 🐛 Bug Fixes

- **Anthropic Protocol Compatibility**: Enhanced base URL normalization in `normalizeBase()` to strip `/messages` endpoints (5M tokens/day dedicated quota).
- **Snapshot Path Traversal Hardening**: Wrapped snapshot IDs in `path.basename()` inside `loadSnapshot()` to prevent path traversal outside `~/.bailucode/snapshots/`.
- **Static Core Imports & User-Agent Sync**: Replaced dynamic `await import("node:fs")` and `require("node:path")` with top-level static ES imports. Aligned all crawler and search User-Agent headers to `BailuAgent/1.1.8`.
- **API Key & TinyFish Masking Fix**: Clean empty input state prior to configuration, bullet masking only when keys are saved, auto-select on focus, and credential overwrite protections.
- **Webview Rendering & A11y Polish**: Fixed markdown link escaping, preserved empty table cells in `flushTable`, added `aria-label` accessibility attributes, and enabled smart auto-scrolling during streaming.

### 🔧 Chores

- **Simulated Installation & Packaging Verification**: Added test suite `test/test-install.js` to extract the `.vsix` package, verify zero source code leaks, validate Extension Host activation, and confirm all 5 commands.
- **Modernized Documentation & Badges**: Refreshed README.md with full-size badges, quick navigation, architectural pillars, QA matrix, and integrated support links.

---

## [1.1.7] — Built-in Markdown Renderer & Session Management

- **Built-in Lightweight Markdown Renderer**: Full Markdown rendering support for assistant messages (`inlineMd`, code blocks, lists, blockquotes, tables, bold/italic/del) with zero external dependencies.
- **Per-message Copy Button**: Added dedicated copy button (`📋`) on each assistant response for quick clipboard copying.
- **Export Transcript**: Export session conversations into standalone Markdown files.
- **Session Snapshot**: Archive and restore conversation state with Save Snapshot.
- **Architecture Mode**: Added `arch` mode tab alongside (`code`, `plan`, `ask`, `debug`, `review`).
- **Skill Placeholder Hint**: `@skill:<name>` syntax in chat input for dynamic skill runbook injection.

---

## [1.1.6] — TinyFish Web Intelligence & Global Persistence

- Integrated TinyFish API (`api.search.tinyfish.ai` & `api.fetch.tinyfish.ai`) for high-precision AI web search, crawling, and scraping with graceful DuckDuckGo/HTTP fallbacks.
- Intelligent URL detection in Web action: automatically crawls and extracts full-browser rendered Markdown when given a URL.
- Configurable TinyFish API Key in VS Code configuration (`bailu.tinyfishApiKey`), Settings UI, and `~/.bailucode/config.json`.
- Global `~/.bailucode` persistence (config, skills, agents, usage tracking) synchronized with VS Code configuration.
- High-performance O(1) streaming DOM updates with active element buffering and WCAG accessibility improvements.
- Secure automated file generation from AI code blocks with recursive directory creation and path traversal guards.
- Modern ES2022 output without synthetic `__importStar` / `__createBinding` runtime bloat.
- Activity Bar official theme-adaptive SVG icon.
- Added explicit `activationEvents` and `extensionKind: ["workspace", "ui"]` for universal Code-OSS / VSCodium / Remote compatibility.
- Implemented `vscode.Disposable` lifecycle for provider and settings panel deduplication to prevent resource and listener leaks.
- Injected Antigravity (`agy`) Superpowers & Agent Skills ecosystem: native TDD, 4-phase systematic debugging, verification before completion, and 350+ skills & subagents.

---

## [0.1.5] — Web Search, Bookmarks & Theme

- Web button: DDG JSON/HTML then model reply.
- Non-auto models: safe `reasoning_effort`, smaller `max_tokens`, JSON fallback.
- Bookmarks for models. Theme `auto`/`dark`/`light`.
- Footer and AUTHOR.md with developer contacts.

---

## [0.1.4] — DuckDuckGo Search & Activity Icon

- Rebased on working 0.1.3 runtime (no webtools module).
- Fix: model change must not reset token or chat (hydrate guard).
- Web search button uses DuckDuckGo HTML (no extra API key), inlined in extension.js.
- Activity icon: 24x24 SVG path fill #C5C5C5 (VS Code/VSCodium classic).
- Activation must succeed: no export-before-init crash.

---

## [0.1.3] — Skills, Agents & English Default

- Skills/agents, Debug/Review modes, English default, no non-English replies.
