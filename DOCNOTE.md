# DOCNOTE

## Architecture & Evolution

### Versi 1.1.8 (Saat Ini)

1. **Ekspansi Katalog Model Sesuai Dashboard Bailu (38 Model Aktif)**:
   - Menyelaraskan katalog model dengan dashboard akun live pengguna: dari 24 model menjadi 38 model terverifikasi lengkap dengan metadata kuota konteks (hingga 1M token), batas output (hingga 256K token), dan tag kapabilitas.
   - Menambahkan flagship generasi baru `bailu-2.8` (benchmark setara Claude Opus 5, multimodal 1M konteks, 131K output), varian kuantisasi `bailu-2.8-nvfp8` (1M konteks, 128K output), MoE `bailu-2.8-lite`, kanal gratis `bailu-2.8-free` (262K konteks, 218K output), agent-trained `bailu-apex-openclaw` (dioptimalkan untuk tool-use & agent workflow), dan model multimodal/edge (`bailu-2.8-vl-2B`, `bailu-2.7-lite-vl`, `bailu-2.7-vl-350m`, `bailu-edge-8b`, `bailu-edge-0.5b`).
2. **Perbaikan Pemetaan Properti Model Badge (`.context` & `.maxOut`)**:
   - Memperbaiki ketidaksesuaian pembacaan properti model antara interface TypeScript dan runtime webview. Kini mendukung `m.context || m.context_length` dan `m.maxOut || m.max_output` sehingga seluruh 38 model menampilkan lencana kapasitas konteks (`1M ctx`, `262K ctx`) dan output (`131K out`, `218K out`) dengan akurat.
3. **Fleksibilitas Reasoning / Thinking Level**:
   - Menambahkan level penalaran `instant`, `max`, dan `off` melengkapi `auto`, `low`, `medium`, `high` pada skema `package.json`, model catalog, dan dropdown webview.
   - Backend `executeChatCompletion()` diperbaiki agar tidak mendrop nilai `instant` dan `max` saat memetakan `reasoning_effort`.
4. **Normalisasi Protokol Anthropic (`/v1/messages`)**:
   - `normalizeBase()` kini otomatis membersihkan trailing `/messages` selain `/chat/completions` dan `/models`, menjamin kompatibilitas penuh dengan kuota terdedikasi 5M tokens/hari protokol Anthropic.
5. **Security Hardening Path Traversal pada Snapshot**:
   - Fungsi `loadSnapshot(id)` kini membungkus ID file dengan `path.basename()` untuk mencegah potensi eksploitasi relative path traversal di luar folder `~/.bailucode/snapshots/`.
6. **Optimasi Modul Statis & Sinkronisasi User-Agent**:
   - Mengganti pemanggilan dinamis `await import("node:fs")` dan `require("node:path")` dengan import statis ES di tingkat atas file.
   - Menyelaraskan seluruh header `User-Agent` pencarian web dan crawler ke versi aktif `BailuAgent/1.1.8`.
7. **Desain GUI Webview Modern, Responsif & User-Friendly**:
   - **Bar Lencana Kapabilitas Model (`#modelBadgeBar`)**: Memunculkan badge dinamis real-time saat model dipilih (misal: `1M ctx`, `131K out`, `Flagship`, `Opus 5 Tier`, `Vision`, `Free`, `NVFP8`, `MoE`, `Edge`) agar developer mengetahui batas dan spesifikasi model secara visual.
   - **Header Bahasa & Tombol Salin per Blok Kode**: Setiap blok kode dalam Markdown kini dibungkus rapi dalam kontainer `.code-box` dengan label bahasa pemrograman dan tombol salin terisolasi (`.code-copy`) dengan proteksi anti-spam klik dan delegasi event CSP nonce-compliant.
   - **Toggle Cerdas Tombol Send / Stop**: Menghemat ruang horizontal pada sidebar sempit (250–300px). Tombol Stop disembunyikan saat idle, dan tombol Send otomatis berganti menjadi tombol Stop merah mencolok selama proses generasi/streaming.
   - **Textarea Auto-Expanding**: Input textarea pesan otomatis menyesuaikan tinggi baris secara responsif hingga 200px ketika pengguna mengetik atau menempelkan potongan kode multiline.
   - **Grid Mode Agen Adaptif**: Tab mode agen (`Code`, `Plan`, `Ask`, `Debug`, `Review`, `Arch`) ditata menggunakan CSS Grid responsif (`repeat(auto-fit, minmax(42px, 1fr))`) agar rapi di berbagai ukuran lebar sidebar editor.
8. **Perbaikan & Masking Input API Key**:
   - Status awal bersih/kosong (`""`) jika key belum pernah disimpan (tanpa masking bintang prematur).
   - Tampilan bintang (`••••••••••••••••`) hanya aktif jika key sudah tersimpan di `SecretStorage` atau konfigurasi.
   - Handler `focus` otomatis menjalankan `select()`, dan handler simpan memproteksi string bintang agar tidak menimpa kredensial asli.
9. **Simulasi Instalasi & Verifikasi Paket VSIX**:
   - Ditambahkan automated test runner `test/test-install.js` yang memverifikasi integritas archive `.vsix`, memastikan nol kebocoran file source `.ts`/`test/`, mengekstrak ke virtual VS Code extension dir, dan menguji aktivasi Extension Host, pendaftaran 5 command, dan lifecycle disposable.
   - Memastikan kontribusi view dan perintah lengkap tanpa deklarasi redundan pada manifest.

### Versi 1.1.7

1. **Lightweight Markdown Renderer**:
   - Renderer Markdown mandiri di dalam webview tanpa dependensi eksternal (mendukung inline styling, code fences, blockquotes, lists, tabel, dan tautan).
2. **Interaktivitas Pesan**:
   - Tombol Salin (`📋`) pada setiap pesan asisten.
   - Tombol Ekspor Transkrip (`📄`) untuk menyimpan seluruh riwayat chat ke file Markdown baru.
   - Tombol Simpan Snapshot (`📷`) untuk mengarsipkan snapshot sesi.
3. **Mode Arsitektur & Injeksi Skill**:
   - Penambahan tab mode `arch` (Arsitektur) pada kontrol mode agen (`code`, `plan`, `ask`, `debug`, `review`, `arch`).
   - Petunjuk placeholder `@skill:<nama>` di textarea input tugas.

### Versi 1.1.6

1. **TinyFish AI Web Search & Crawler**:
   - `api.search.tinyfish.ai`: Hasil pencarian web terstruktur yang dioptimalkan untuk AI.
   - `api.fetch.tinyfish.ai`: Ekstraksi rendering browser nyata menghasilkan Markdown bersih untuk reasoning LLM.
   - Dual fallback strategy: Fallback otomatis ke DuckDuckGo search dan HTTP fetch jika TinyFish tidak dapat dijangkau.
   - Deteksi input URL pintar: Memasukkan URL atau prefix `scrape:` otomatis mengarahkan ke crawler TinyFish.
2. **Cross-IDE & Remote Compatibility**:
   - `contributes.views` dan `"extensionKind": ["workspace", "ui"]` menjamin aktivasi instan di semua fork Code-OSS, VSCodium, Cursor, Windsurf, Trae, Antigravity-IDE, dan Remote Containers.
3. **Disposable Lifecycle**:
   - `BailuViewProvider` mengimplementasikan `vscode.Disposable` yang terdaftar pada `context.subscriptions`. Mencegah tab ganda dan kebocoran listener.
4. **Global Configuration (`~/.bailucode`)**:
   - Konfigurasi, riwayat token/usage, custom agents, dan skills tersimpan persisten di direktori home user dan tersinkronisasi dua arah dengan setting VS Code.
5. **Antigravity Superpowers & Agent Skills Ecosystem**:
   - Injeksi metodologi TDD, 4-phase systematic debugging, dan dynamic discovery untuk 350+ skills & subagents.

---

## Security & Credential Safety

- **Penyimpanan Kredensial**: API Token Bailu disimpan eksklusif pada VS Code `SecretStorage`, tidak pernah ditulis ke `settings.json` dalam bentuk teks biasa.
- **Content Security Policy (CSP)**: Menggunakan cryptographic nonce acak (`crypto.randomUUID().replaceAll("-", "")`) pada setiap pemuatan webview untuk mencegah eksekusi skrip tidak sah.
- **Path Traversal Guard**: Penulisan file memeriksa pola traversal path (`..`, slash/backslash di awal, atau titik dua) untuk mengamankan workspace.
