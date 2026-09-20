# Bailu Agent (VSIX)

Extension VS Code / fork (Antigravity, VSCodium) bergaya panel Kilo untuk API BAILU AI.

## Fitur

- Sidebar Code / Plan / Ask
- Picker model (Auto resmi `bailu-auto`, 2.8, 2.7, Apex, Dash, …)
- Thinking Instant–Max untuk model yang mendukung
- GUI pengaturan: API token (SecretStorage), Base URL, tes `GET /models`
- Chat stream ke `POST /chat/completions`

## Pasang

1. `Extensions: Install from VSIX…`
2. Buka ikon Bailu di Activity Bar
3. ⚙ isi token + Base URL (default `https://bailucode.com/openapi/v1`)
4. Simpan & tes koneksi

Default model: `bailu-auto`.
