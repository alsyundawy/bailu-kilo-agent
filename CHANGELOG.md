# Changelog

## 1.1.8

- **Model Catalog Alignment (38 Models)**: Sinkronisasi lengkap dengan dashboard Bailu terkini. Menambahkan model flagship `bailu-2.8` (Claude Opus 5 Tier, 1M context, 131K output), `bailu-2.8-nvfp8`, `bailu-2.8-lite` (MoE), `bailu-2.8-free`, `bailu-apex-openclaw` (agent workflow & tool use), varian multimodal/vision (`bailu-2.8-vl-2B`, `bailu-2.7-lite-vl`, `bailu-2.7-vl-350m`), serta model edge (`bailu-edge-8b`, `bailu-edge-0.5b`).
- **Model Badges Property Mapping**: Memperbaiki pemetaan properti badge (`.context` & `.maxOut`) agar sinkron dengan interface `CatalogModel` dan webview DOM. Seluruh 38 model kini menampilkan lencana kapasitas (`1M ctx`, `131K out`, `262K ctx`, `218K out`) dengan akurat.
- **Thinking Levels Support (`instant`, `max`, `off`)**: Memperluas skema dan opsi thinking level untuk model Bailu penalaran tinggi (`bailu-2.8`, `bailu-apex-2.7`, `bailu-2.7-lite`). Memperbaiki validasi backend agar `instant` dan `max` diteruskan dengan benar ke API.
- **Anthropic Protocol Compatibility**: Normalisasi URL dasar di `normalizeBase()` untuk membersihkan endpoint `/messages` (kuota terdedikasi 5M tokens/hari).
- **Snapshot Path Traversal Hardening**: Membungkus snapshot ID dengan `path.basename()` pada `loadSnapshot()` untuk mencegah path traversal keluar dari direktori `~/.bailucode/snapshots/`.
- **Static Core Imports & User-Agent Sync**: Menghapus `await import("node:fs")` dinamis dan menyelaraskan seluruh User-Agent HTTP crawler/search menjadi `BailuAgent/1.1.8`.
- **GUI UX Overhaul - Model Specs & Capability Badges Bar (`#modelBadgeBar`)**: Menampilkan pill badge dinamis untuk context length (misal: `1M ctx`, `262K ctx`), max output tokens (misal: `131K out`, `218K out`), dan tag kapabilitas (`Opus 5 Tier`, `Vision`, `Free`, `NVFP8`, `MoE`, `Edge`).
- **GUI UX Overhaul - Code Block Language Header & Dedicated Copy**: Fenced code blocks di Markdown kini dilengkapi baris header bahasa dan tombol "Copy" terisolasi (`.code-copy`) dengan animasi konfirmasi `✓` yang aman terhadap Content Security Policy (CSP).
- **GUI UX Overhaul - Dynamic Send / Stop Button Toggle**: Menyembunyikan tombol Stop saat status idle untuk menghemat ruang pada sidebar VS Code yang sempit, dan menampilkannya secara otomatis saat model sedang streaming generasi.
- **GUI UX Overhaul - Auto-Expanding Chat Input**: Textarea input chat secara otomatis memperbesar tingginya (hingga 200px) saat pengguna mengetik prompt panjang atau kode multiline.
- **GUI UX Overhaul - Responsive Agent Modes Grid**: Mode tab agen (`Code`, `Plan`, `Ask`, `Debug`, `Review`, `Arch`) ditata rapi dengan CSS Grid responsif (`minmax(42px, 1fr)`).
- **API Key & TinyFish Masking Fix**: Status input bersih/kosong saat belum pernah diisi, masking bintang hanya jika tersimpan, auto-select saat fokus, dan proteksi anti-overwrite kredensial.
- **Simulated Installation & Packaging Verification**: Menambahkan test suite `test/test-install.js` untuk mengekstrak file `.vsix`, memverifikasi kelengkapan bundle tanpa kebocoran file sumber, menguji aktivasi Extension Host, dan memastikan ketersediaan seluruh 5 perintah extension.
- **Context Enrichment & Capacity**: Pelampiran listing file dan workspace context otomatis (maksimal 16 KB), batas output adaptif hingga 131K token, timeout 10 menit, dan penulisan multi-file otomatis hingga 20 file.

## 1.1.7

- Built-in Lightweight Markdown Renderer: Dukungan rendering Markdown lengkap untuk pesan asisten (`inlineMd`, code blocks, lists, blockquotes, tables, bold/italic/del) tanpa dependency eksternal.
- Per-message Copy Button: Menambahkan tombol Salin (`📋`) pada setiap balasan asisten untuk mempermudah penyalinan respons AI ke clipboard.
- Export Transcript: Menambahkan tombol Ekspor Transkrip (`📄`) untuk mengekspor riwayat percakapan sesi menjadi file Markdown terpisah.
- Session Snapshot: Menambahkan tombol Simpan Snapshot (`📷`) untuk mendokumentasikan state percakapan saat itu.
- Architecture Mode: Menambahkan tab mode `arch` (Arsitektur) melengkapi mode agen bawaan (`code`, `plan`, `ask`, `debug`, `review`).
- Skill Placeholder Hint: Menambahkan petunjuk `@skill:<nama>` di textarea input chat untuk injeksi runbook skill dinamis.

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
