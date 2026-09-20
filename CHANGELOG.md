# Changelog

## 1.1.9 — GUI Modernization, Model Expansion & Reliability Patch

> **TypeScript compile**: `tsc 5.x` · **VSCode Engine**: `^1.90.0` · **Node**: `≥ 18`

- **`feat` Model Catalog Expansion (39 Models — `bailu-turing`)**: Synchronized the enterprise flagship model `bailu-turing` (BaiLu Turing, Enterprise Deep Reasoning Flagship: 1,048,576 context, 131,072 max output, multimodal + deep reasoning) identified from the user's live Bailu account dashboard. The verified AI catalog now reaches 39 models.
- **`feat` Comprehensive GUI UX/UI Modernization**:
  - **Codicon-Style Crisp Inline SVGs**: Replaced legacy system OS emojis (`📄`, `📷`, `＋`, `⚙`, `←`) with modern, developer-oriented SVGs that are consistent and adaptive across VS Code Dark, Light, and High-Contrast themes.
  - **Welcome Card & Quick Action Starters**: Added an interactive `#welcomeCard` with quick action prompt cards (`💡 Explain active file`, `✨ Refactor & clean`, `🧪 Generate unit tests`, `🔍 Debug & find bugs`) when the chat view is empty, automatically dismissed once the first message is sent.
  - **Sharper Message Bubble Hierarchy**: Distinct visual contrast between user bubbles (`.msg.user` with subtle theme accent and `👤 You` badge) and assistant bubbles (`.msg.assistant` with `🤖 Bailu` badge and SVG copy button), dramatically improving readability on narrow sidebars (250–300px).
  - **Live Typing / Streaming Indicator**: Active typing cursor (`▍`) with `@keyframes blinkCursor` animation while receiving SSE token streams (`data-stream="1"`), giving immediate visual feedback that the model is actively thinking and composing a response.
  - **Status Indicator with Pulse Glow**: Status indicator (`#statusDot`) with a glowing green dot (`.dot-ready`) when idle and a pulsing orange/blue dot (`.dot-busy`) while processing prompts or crawling the web.
  - **Structured Settings Cards**: Grouped settings into clean cards (`.setting-group`): Authentication & Keys, Model & Reasoning Defaults, Preferences, and Telemetry & Usage.
  - **Thinking Selector Polish**: Added adaptive `.no-think` styling that dims reasoning controls when the selected model does not support reasoning sliders.
- **`fix` SSE TextDecoder Final-Flush Bug**: Resolved an issue where API servers terminate streaming connections without a trailing newline, leaving the final chunk trapped in the decoder buffer. Fixed by executing a parameterless `dec.decode()` flush at the end of the stream reader loop.
- **`fix` `reasoning_effort` Dropped on Streaming Fallback**: When streaming encounters network disruptions or 503 gateway errors, the automatic non-streaming fallback previously dropped `reasoning_effort`. Now `body.reasoning_effort` is fully preserved in the fallback payload.
- **`fix` `MAX_OUT_CAP` vs Catalog `maxOut` Discrepancy**: Models with output capacities up to 256K tokens were previously constrained by an artificial 128K ceiling. Raised the cap to `262144` (256K) and adjusted `bailu.maxTokens` configuration boundaries accordingly.
- **`fix` Linter & Code Hygiene**: Fixed regex loop assignment in `src/webtools.ts` (`while (m !== null)`), ensuring 0 errors under the Biome linter.
- **`fix` User-Agent & Version Sync**: Harmonized `USER_AGENT` and `EXTENSION_VERSION` constants in `src/extension.ts` to always match the active release version (`BailuAgent/1.1.9`).
- **`chore` Comprehensive Audit & Verification Suite**: Updated `test/verify.js` and `test/audit.js` covering URL normalization, token isolation, model catalog validation, token output caps, and clean packaging checks.
- **`fix` Internal Audit — UA Sync `webtools.ts`**: Synchronized the User-Agent string in `src/webtools.ts` from `BailuAgent/1.1.8` to `BailuAgent/1.1.9`, aligning all web search and crawling HTTP headers with the active extension release.
- **`fix` Internal Audit — Catalog `maxOut` Alignment (`bailu-apex-2.7`, `bailu-apex`)**: Corrected `maxOut` for `bailu-apex-2.7` and `bailu-apex` from `512000` to `262144` (= `MAX_OUT_CAP`). Previously, badges displayed `512K out` which could never be achieved because runtime capped it silently, misleading users.
- **`fix` Internal Audit — Accessibility `setBusy()` Textarea Guard**: Added `aria-disabled="true"` and `readonly` to the prompt input textarea while the model is streaming, and cleanly removed them upon idle. Prevents typing while busy and clarifies accessibility state for screen readers. Also added dynamic `title` tooltips to `#statusDot`.
- **`fix` Complete English System Messages & Localization**: Replaced all remaining hardcoded non-English strings in `src/extension.ts` (`"Token kosong"` → `"API token is missing"`, `"Memanggil "` → `"Calling "`, `"model dari API"` → `"models from API"`). All backend error messages, status reports, and UI defaults are now strictly 100% English.
- **`fix` Sandboxed & Read-Only Environment Resilience**: Hardened `writeJson()` in `src/home.ts` with a defensive `try/catch` wrapper to prevent unhandled I/O exceptions in read-only filesystems, restricted containers, and remote sandboxes.
- **`feat` Mandatory Extension Restart Prompt on Install / Update / Reinstall**: Implemented `checkInstallOrUpdateRestart()` in `src/extension.ts`. Any installation, upgrade, update, re-installation, or download automatically triggers an interactive VS Code notification prompting the user to restart the Extension Host (`workbench.action.restartExtensionHost`) or reload the window (`workbench.action.reloadWindow`). This guarantees zero state collisions, fresh `SecretStorage` access, and immediate sidebar activation.
- **`pkg` Production VSIX Artifact Specification**:
  - Package: `bailu-kilo-agent-1.1.9.vsix`
  - Target Platform: Universal (VS Code, Code-OSS, VSCodium, Cursor, Windsurf, Trae, Antigravity-IDE)
  - Total Packed Files: `25 files` (clean packaging, zero source code or test directory leaks)
  - Distribution: Standalone `.vsix` attached to GitHub Release v1.1.9 with verified SHA-256 checksum

## 1.1.8

- **Model Catalog Alignment (38 Models)**: Full synchronization with the live Bailu dashboard. Added flagship model `bailu-2.8` (Claude Opus 5 Tier, 1M context, 131K output), `bailu-2.8-nvfp8`, `bailu-2.8-lite` (MoE), `bailu-2.8-free`, `bailu-apex-openclaw` (agent workflow & tool use), multimodal/vision variants (`bailu-2.8-vl-2B`, `bailu-2.7-lite-vl`, `bailu-2.7-vl-350m`), and edge models (`bailu-edge-8b`, `bailu-edge-0.5b`).
- **Model Badges Property Mapping**: Fixed badge property mappings (`.context` & `.maxOut`) to align with the `CatalogModel` interface and webview DOM. All models accurately display capacity badges (`1M ctx`, `131K out`, `262K ctx`, `218K out`).
- **Thinking Levels Support (`instant`, `max`, `off`)**: Expanded thinking level options for advanced reasoning models (`bailu-2.8`, `bailu-apex-2.7`, `bailu-2.7-lite`). Fixed backend validation so `instant` and `max` are forwarded accurately to the API.
- **Anthropic Protocol Compatibility**: Enhanced base URL normalization in `normalizeBase()` to strip `/messages` endpoints (5M tokens/day dedicated quota).
- **Snapshot Path Traversal Hardening**: Wrapped snapshot IDs in `path.basename()` inside `loadSnapshot()` to prevent path traversal outside `~/.bailucode/snapshots/`.
- **Static Core Imports & User-Agent Sync**: Replaced dynamic `await import("node:fs")` and `require("node:path")` with top-level static ES imports. Aligned all crawler and search User-Agent headers to `BailuAgent/1.1.8`.
- **GUI UX Overhaul — Model Specs & Capability Badges Bar (`#modelBadgeBar`)**: Rendered real-time dynamic pill badges for context length (e.g. `1M ctx`, `262K ctx`), max output tokens (e.g. `131K out`, `218K out`), and capability tags (`Opus 5 Tier`, `Vision`, `Free`, `NVFP8`, `MoE`, `Edge`).
- **GUI UX Overhaul — Code Block Language Header & Dedicated Copy**: Fenced code blocks in Markdown now feature language header bars and isolated copy buttons (`.code-copy`) with CSP-safe `✓` confirmation animations.
- **GUI UX Overhaul — Dynamic Send / Stop Button Toggle**: Automatically toggles between Send and Stop buttons to maximize space on compact VS Code sidebars.
- **GUI UX Overhaul — Auto-Expanding Chat Input**: Textarea dynamically expands up to 200px when typing long prompts or pasting multi-line code.
- **GUI UX Overhaul — Responsive Agent Modes Grid**: Agent mode tabs (`Code`, `Plan`, `Ask`, `Debug`, `Review`, `Arch`) organized with responsive CSS Grid (`minmax(42px, 1fr)`).
- **API Key & TinyFish Masking Fix**: Clean empty input state prior to user configuration, bullet masking only when keys are saved, auto-select on focus, and credential overwrite protections.
- **Simulated Installation & Packaging Verification**: Added test suite `test/test-install.js` to extract the `.vsix` package, verify zero source code leaks, validate Extension Host activation, and confirm all 5 commands.
- **Context Enrichment & Capacity**: Automated workspace context enrichment (up to 16 KB), adaptive output limits up to 131K tokens, 10-minute timeout, and multi-file automated writing for up to 20 files.
- **Automated File Writing Mode Guard**: Disabled automated file creation (`applyGeneratedFiles`) when in `Ask` and `Plan` modes, and filtered common library names (e.g., `vue.js`, `chart.js`) from being erroneously written as workspace files.
- **Webview Rendering & A11y Polish**: Fixed markdown link escaping, preserved empty table cells in `flushTable`, added `aria-label` accessibility attributes, and enabled smart auto-scrolling during streaming.
- **Modernized Documentation & Badges**: Refreshed README.md with full-size badges, quick navigation, architectural pillars, QA matrix, and integrated support links.

## 1.1.7

- **Built-in Lightweight Markdown Renderer**: Full Markdown rendering support for assistant messages (`inlineMd`, code blocks, lists, blockquotes, tables, bold/italic/del) with zero external dependencies.
- **Per-message Copy Button**: Added dedicated copy button (`📋`) on each assistant response for quick clipboard copying.
- **Export Transcript**: Added Export Transcript button (`📄`) to export session conversations into standalone Markdown files.
- **Session Snapshot**: Added Save Snapshot button (`📷`) to archive the conversation state.
- **Architecture Mode**: Added `arch` mode tab, complementing built-in agent modes (`code`, `plan`, `ask`, `debug`, `review`).
- **Skill Placeholder Hint**: Added `@skill:<name>` hint in chat input textarea for dynamic skill runbook injection.

## 1.1.6

- Integrated TinyFish API (`api.search.tinyfish.ai` & `api.fetch.tinyfish.ai`) for high-precision AI web search, crawling, and scraping with graceful DuckDuckGo/HTTP fallbacks.
- Intelligent URL detection in Web action: automatically crawls and extracts full-browser rendered markdown when given a URL.
- Configurable TinyFish API Key in VS Code configuration (`bailu.tinyfishApiKey`), Settings UI, and `~/.bailucode/config.json`.
- Global `~/.bailucode` persistence (config, skills, agents, usage tracking) synchronized with VS Code configuration.
- Settings view accessible both in the sidebar and as a dedicated editor panel tab.
- High-performance O(1) streaming DOM updates with active element buffering and WCAG accessibility improvements.
- Secure automated file generation from AI code blocks with recursive directory creation and path traversal guards.
- Zero-backtracking regex-free HTML tag stripper for fast, safe web search previews.
- Modern ES2022 output without synthetic `__importStar` / `__createBinding` runtime bloat.
- Activity Bar official theme-adaptive #d7dae0 SVG icon.
- Added explicit `activationEvents` and `extensionKind: ["workspace", "ui"]` for universal Code-OSS / VSCodium / Remote compatibility.
- Implemented `vscode.Disposable` lifecycle for provider and settings panel deduplication to prevent resource and listener leaks.
- Injected Antigravity (`agy`) Superpowers & Agent Skills ecosystem: native TDD, 4-phase systematic debugging, verification before completion, code simplification, dynamic discovery of 350+ skills & subagents (`code-reviewer`, `security-auditor`, `test-engineer`, `web-performance-auditor`), and optimized token-bounded prompt injection.
- Interactive footer branding with developer website links: ALSYUNDAWY IT SOLUTION COPY LEFT 2023–2026.

## 0.1.5

- Web button: DDG JSON/HTML then model reply; create stream bubble if missing.
- Non-auto models: safe reasoning_effort, smaller max_tokens, JSON fallback.
- Bookmarks for models. Theme auto/dark/light.
- Removed duplicate title-bar Settings/New Task.
- Footer and AUTHOR.md with Harry DS Alsyundawy contacts (2026).
- Activity Bar icon is the built-in `$(comment-discussion)` codicon (VSCodium-safe).

## 0.1.4

- Rebased on working 0.1.3 runtime (no webtools module).
- Fix: model change must not reset token or chat (hydrate guard; locale no longer resets task).
- Web search button uses DuckDuckGo HTML (no extra API key), inlined in extension.js.
- Activity icon: 24x24 SVG path fill #C5C5C5 (VS Code/VSCodium classic). PNG removed from activity bar.
- Activation must succeed: no export-before-init crash.

## 0.1.3

- Skills/agents, Debug/Review, English default, no Chinese replies.
