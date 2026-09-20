# DOCNOTE

## Architecture & Evolution

### Version 1.1.9 (Current)

1. **Enterprise Flagship Model Synchronization `bailu-turing` (39 Active Models)**:
   - Identified from the user's live Bailu account dashboard: addition of `bailu-turing` (BaiLu Turing, Enterprise Deep Reasoning Flagship: 1,048,576 context, 131,072 max output, multimodal + deep reasoning).
   - Brings the verified model catalog in the extension to 39 models with full reasoning and vision capabilities.
2. **Comprehensive GUI Modernization & Webview UI Overhaul**:
   - **Transition to Codicon Vector Icons**: All action buttons (`#btnExport`, `#btnSnap`, `#btnNew`, `#btnSet`, `#btnBack`, and copy buttons) transitioned from OS unicode emojis to consistent, crisp, and theme-adaptive inline SVGs supporting VS Code Dark, Light, and High-Contrast themes.
   - **Welcome Card & Quick Action Starters (`#welcomeCard`)**: Provides an informative starting interface when the chat view is empty, offering one-click prompt templates (`💡 Explain active file`, `✨ Refactor & clean`, `🧪 Generate unit tests`, `🔍 Debug & find bugs`) that automatically dismiss once a conversation starts.
   - **Distinct Visual Message Bubble Separation (User vs Assistant)**: High-contrast styling between user messages (`.msg.user` with semi-transparent theme accent and `👤 You` badge) and assistant messages (`.msg.assistant` with `🤖 Bailu` badge and SVG copy button), dramatically improving readability on narrow sidebars (250–300px).
   - **Streaming Typing Indicator**: Added an active cursor `▍` with `@keyframes blinkCursor` animation during SSE token reception (`data-stream="1"`), giving clear visual feedback that the model is actively composing an answer.
   - **Pulsing Status Indicator (`#statusDot`)**: Interactive status indicator (gentle green `.dot-ready` vs dynamic pulsing `.dot-busy`) providing real-time visibility into connection and agent readiness.
   - **Structured Settings Groups (`.setting-group`)**: Reorganized settings forms into clean, categorized cards: Authentication & Keys, Model & Reasoning Defaults, Preferences, and Telemetry & Usage.
   - **Thinking Intensity Polish**: Implemented adaptive `.no-think` selector to dim reasoning intensity controls whenever the selected model lacks reasoning parameter support.
3. **SSE Buffer Bug Fix & Streaming Fallback**:
   - Resolved the issue of missing final chunks in SSE streaming when the server terminates connection without a trailing newline via parameterless `dec.decode()`.
   - Prevented dropped `reasoning_effort` parameters when streaming requests fall back automatically to non-streaming mode.
4. **Output Limit Increase (`MAX_OUT_CAP` = 262144)**:
   - Aligned maximum token output capacity up to 256K tokens to accommodate new-generation models without artificial truncation at the former 128K ceiling.
5. **Code Hygiene & Biome Linter**:
   - Fixed regex loop assignment in `src/webtools.ts` (`while (m !== null)`), ensuring 100% compliance with static analysis and linters.
6. **Internal Audit Depth — UA Sync & Catalog Alignment**:
   - `src/webtools.ts`: User-Agent string `BailuAgent/1.1.8` updated to `BailuAgent/1.1.9` (synchronizing HTTP headers across all web search and crawling features).
   - `src/models.ts` (`bailu-apex-2.7`, `bailu-apex`): `maxOut` corrected from `512000` to `262144` (= `MAX_OUT_CAP`) — output badge no longer displays an unreachable runtime value.
   - `test/audit.js`: Updated version comment header to `v1.1.9`.
7. **Accessibility Guard `setBusy()` — Textarea `aria-disabled` + statusDot Tooltip**:
   - While the model is streaming, `#input` textarea receives `aria-disabled="true"` and `readonly` to semantically communicate disabled status to screen readers and assistive tech.
   - Attributes are cleanly removed once streaming finishes (`setBusy(false)`).
   - `#statusDot` features a dynamic `title` tooltip: `"Model is generating…"` when busy, and `"Ready — type to chat"` when idle.
8. **100% English System Messages & Complete Localization**:
   - Replaced all lingering non-English backend strings in `src/extension.ts` (`"Token kosong"` → `"API token is missing"`, `"Memanggil "` → `"Calling "`, `"model dari API"` → `"models from API"`).
   - All extension runtime logs, error reports, and status notices default strictly to clean, professional English.
9. **Sandboxed & Read-Only Environment Hardening**:
   - Wrapped `writeJson()` in `src/home.ts` within a defensive `try/catch` block, preventing unhandled runtime exceptions in restricted Docker containers, Nix environments, or read-only workspaces.
10. **Model Specification & Thinking Accuracy**:

- Synchronized documentation for `bailu-turing` thinking levels to `Low – Max` matching `src/models.ts`.

11. **Mandatory Restart Protocol on Install, Update, Upgrade & Reinstall**:

- Integrated `checkInstallOrUpdateRestart()` in `src/extension.ts`.
- Compares active package version, installation directory, and filesystem modification timestamps against `globalState` cache.
- On any fresh download, update, upgrade, or reinstallation, immediately prompts the user with action buttons to restart the Extension Host (`workbench.action.restartExtensionHost`) or reload the window (`workbench.action.reloadWindow`).
- Ensures clean environment initialization without stale in-memory state or orphaned SecretStorage handlers.

12. **Production VSIX Package Specification (v1.1.9)**:
    - **Archive**: `bailu-kilo-agent-1.1.9.vsix`
    - **Target Platform**: Universal (VS Code, Code-OSS, VSCodium, Cursor, Windsurf, Trae, Antigravity-IDE)
    - **File Count**: `25 files`
    - **Distribution**: Standalone `.vsix` attached to GitHub Release v1.1.9 with verified SHA-256 checksum
    - **Exclusion Compliance**: Strict 0-source-leak policy verified by `test/test-install.js` (no TypeScript source, no test suites, no git metadata packed).

### Version 1.1.8

1. **Model Catalog Expansion per Bailu Dashboard (38 Active Models)**:
   - Aligned the model catalog with the user's live account dashboard: from 24 models to 38 verified models complete with context quotas (up to 1M tokens), output limits (up to 256K tokens), and capability tags.
   - Added new generation flagship `bailu-2.8` (Claude Opus 5 benchmark tier, multimodal 1M context, 131K output), quantized variant `bailu-2.8-nvfp8` (1M context, 128K output), MoE `bailu-2.8-lite`, free community channel `bailu-2.8-free` (262K context, 218K output), agent-trained `bailu-apex-openclaw` (optimized for tool-use and agent workflows), and multimodal/edge models (`bailu-2.8-vl-2B`, `bailu-2.7-lite-vl`, `bailu-2.7-vl-350m`, `bailu-edge-8b`, `bailu-edge-0.5b`).
2. **Model Badge Property Mapping Fix (`.context` & `.maxOut`)**:
   - Resolved discrepancies in property reading between TypeScript interfaces and runtime webview. Now supports `m.context || m.context_length` and `m.maxOut || m.max_output`, allowing all models to accurately display capacity badges (`1M ctx`, `262K ctx`, `131K out`, `218K out`).
3. **Flexible Reasoning / Thinking Levels**:
   - Added `instant`, `max`, and `off` reasoning levels alongside `auto`, `low`, `medium`, `high` across `package.json` schema, model catalog, and webview dropdown.
   - Patched backend `executeChatCompletion()` so `instant` and `max` values are not dropped when mapping `reasoning_effort`.
4. **Anthropic Protocol Normalization (`/v1/messages`)**:
   - `normalizeBase()` automatically strips trailing `/messages` in addition to `/chat/completions` and `/models`, ensuring compatibility with the dedicated 5M tokens/day Anthropic protocol quota.
5. **Snapshot Path Traversal Security Hardening**:
   - `loadSnapshot(id)` wraps file IDs in `path.basename()` to eliminate relative path traversal exploits outside `~/.bailucode/snapshots/`.
6. **Static Module Optimization & User-Agent Synchronization**:
   - Replaced dynamic imports (`await import("node:fs")` and `require("node:path")`) with top-level static ES imports.
   - Aligned all web search and crawler `User-Agent` headers to the active release `BailuAgent/1.1.8`.
7. **Modern, Responsive & User-Friendly Webview GUI**:
   - **Model Capability Badge Bar (`#modelBadgeBar`)**: Displays dynamic real-time badges upon model selection (`1M ctx`, `131K out`, `Flagship`, `Opus 5 Tier`, `Vision`, `Free`, `NVFP8`, `MoE`, `Edge`), allowing developers to visually verify limits and specifications.
   - **Language Header & Copy Button per Code Block**: Every code block in Markdown is wrapped in a `.code-box` container with programming language tags and an isolated `.code-copy` button featuring click-spam protection and CSP nonce-compliant event delegation.
   - **Smart Send / Stop Button Toggle**: Saves horizontal space in narrow sidebars (250–300px). Hides the Stop button during idle and toggles Send into a conspicuous Stop button during streaming generation.
   - **Auto-Expanding Textarea**: Message input dynamically expands up to 200px when typing long prompts or pasting multiline code snippets.
   - **Adaptive Agent Mode Grid**: Agent mode tabs (`Code`, `Plan`, `Ask`, `Debug`, `Review`, `Arch`) laid out with responsive CSS Grid (`repeat(auto-fit, minmax(42px, 1fr))`) for clean rendering across all editor sidebar widths.
8. **API Key Input Masking & Protection**:
   - Clean empty initial state (`""`) when no key has been stored (no premature bullet masking).
   - Bullet masking (`••••••••••••••••`) only activates when a key is already persisted in `SecretStorage` or configuration.
   - Focus handler runs `select()`, and save handler guards bullet strings from accidentally overwriting actual credentials.
9. **Simulated Installation & VSIX Package Verification**:
   - Added automated test runner `test/test-install.js` verifying `.vsix` archive integrity, ensuring zero source code leaks (`.ts`/`test/`), extracting into a virtual VS Code extension dir, and testing Extension Host activation, 5 command registrations, and disposable lifecycles.
   - Ensured comprehensive view and command contributions without redundant declarations in the manifest.

### Version 1.1.7

1. **Lightweight Markdown Renderer**:
   - Standalone in-webview Markdown renderer with zero external dependencies (supports inline styling, code fences, blockquotes, lists, tables, and links).
2. **Message Interactivity**:
   - Copy button (`📋`) on each assistant response.
   - Export Transcript button (`📄`) to save entire session history to a new Markdown file.
   - Save Snapshot button (`📷`) to archive session state.
3. **Architecture Mode & Skill Injection**:
   - Added `arch` (Architecture) mode tab to agent controls (`code`, `plan`, `ask`, `debug`, `review`, `arch`).
   - Placeholder hint `@skill:<name>` in task input textarea.

### Version 1.1.6

1. **TinyFish AI Web Search & Crawler**:
   - `api.search.tinyfish.ai`: Structured, AI-optimized web search results.
   - `api.fetch.tinyfish.ai`: Real browser rendering extraction producing clean Markdown for LLM reasoning.
   - Dual fallback strategy: Automatic fallback to DuckDuckGo search and HTTP fetch when TinyFish is unreachable.
   - Smart URL input detection: Entering URLs or `scrape:` prefix routes directly to TinyFish crawler.
2. **Cross-IDE & Remote Compatibility**:
   - `contributes.views` and `"extensionKind": ["workspace", "ui"]` guarantee instant activation across all Code-OSS forks, VSCodium, Cursor, Windsurf, Trae, Antigravity-IDE, and Remote Containers.
3. **Disposable Lifecycle**:
   - `BailuViewProvider` implements `vscode.Disposable` registered in `context.subscriptions`, preventing duplicate tabs and listener leaks.
4. **Global Configuration (`~/.bailucode`)**:
   - Configuration, token/usage history, custom agents, and skills persist in user home directory with bi-directional synchronization to VS Code settings.
5. **Antigravity Superpowers & Agent Skills Ecosystem**:
   - Injected TDD methodology, 4-phase systematic debugging, and dynamic discovery for 350+ skills & subagents.

---

## Security & Credential Safety

- **Credential Storage**: Bailu API tokens are stored exclusively in VS Code `SecretStorage`, never written to `settings.json` in plaintext.
- **Content Security Policy (CSP)**: Employs a random cryptographic nonce (`crypto.randomUUID().replaceAll("-", "")`) on every webview reload to prevent unauthorized script execution.
- **Path Traversal Guard**: Automated file writing validates against traversal patterns (`..`, leading slash/backslash, or colon) to keep workspace files secure.
