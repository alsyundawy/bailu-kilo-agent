const UA =
  "Mozilla/5.0 (compatible; BailuAgent/1.1.9; +https://bailucode.com) AppleWebKit/537.36";
const TINYFISH_API_KEY = process.env.TINYFISH_API_KEY || "";

export async function webSearch(query: string): Promise<string> {
  const q = String(query || "")
    .trim()
    .slice(0, 200);
  if (!q) return "Empty query.";

  if (TINYFISH_API_KEY) {
    try {
      const tf = await tinyfishSearch(q);
      if (tf) return tf;
    } catch {
      /* fallback to DuckDuckGo */
    }
  }

  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
  const html = await fetchText(url, 15000);
  const items = parseDdg(html).slice(0, 6);
  if (!items.length) {
    const lite = await duckLite(q);
    if (lite) return lite;
    return "No search results.";
  }
  return items
    .map(
      (r, i) =>
        i +
        1 +
        ". " +
        r.title +
        "\n   " +
        r.url +
        (r.snip ? "\n   " + r.snip : ""),
    )
    .join("\n");
}

export async function webFetch(target: string): Promise<string> {
  const u = String(target || "").trim();
  if (!isPublicHttp(u)) return "Blocked or invalid URL.";

  if (TINYFISH_API_KEY) {
    try {
      const tf = await tinyfishFetch(u);
      if (tf) return tf.slice(0, 10000);
    } catch {
      /* fallback to direct HTML fetch */
    }
  }

  const html = await fetchText(u, 15000);
  return stripHtml(html).slice(0, 6000);
}

export const WEB_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web via TinyFish Search Engine with DuckDuckGo fallback.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "Scrape and crawl web pages via TinyFish Fetch API with direct HTTP fallback.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
];

export async function runWebTool(
  name: string,
  args: { query?: string; url?: string },
): Promise<string> {
  if (name === "web_search") return webSearch(args.query || "");
  if (name === "web_fetch") return webFetch(args.url || "");
  return "Unknown tool.";
}

async function tinyfishSearch(query: string): Promise<string> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(
      "https://api.search.tinyfish.ai?query=" + encodeURIComponent(query),
      {
        headers: { "X-API-Key": TINYFISH_API_KEY, Accept: "application/json" },
        signal: ac.signal,
      },
    );
    if (!res.ok) return "";
    const j = (await res.json()) as {
      results?: { title?: string; url?: string; snippet?: string }[];
    };
    const results = j?.results;
    if (!Array.isArray(results) || !results.length) return "";
    return results
      .slice(0, 6)
      .map(
        (r, i) =>
          `${i + 1}. ${r.title || "Result"}\n   ${r.url || ""}${r.snippet ? "\n   " + r.snippet : ""}`,
      )
      .join("\n");
  } finally {
    clearTimeout(t);
  }
}

async function tinyfishFetch(url: string): Promise<string> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20000);
  try {
    const res = await fetch("https://api.fetch.tinyfish.ai", {
      method: "POST",
      headers: {
        "X-API-Key": TINYFISH_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ urls: [url] }),
      signal: ac.signal,
    });
    if (!res.ok) return "";
    const j = (await res.json()) as {
      results?: { title?: string; text?: string }[];
    };
    const first = j?.results?.[0];
    if (!first?.text) return "";
    const title = first.title ? `# ${first.title}\n\n` : "";
    return title + first.text;
  } finally {
    clearTimeout(t);
  }
}

function parseDdg(
  html: string,
): { title: string; url: string; snip: string }[] {
  const out: { title: string; url: string; snip: string }[] = [];
  const re =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m = re.exec(html);
  while (m !== null) {
    const url = decodeDdg(decodeEntities(m[1]));
    const title = stripHtml(m[2]).trim();
    if (url && title) {
      out.push({ title, url, snip: "" });
      if (out.length >= 8) break;
    }
    m = re.exec(html);
  }
  const snips = [
    ...html.matchAll(
      /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi,
    ),
  ];
  snips.forEach((s, i) => {
    if (out[i]) out[i].snip = stripHtml(s[1]).trim().slice(0, 180);
  });
  return out;
}

function decodeDdg(href: string): string {
  try {
    const u = new URL(href, "https://html.duckduckgo.com/");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    /* ignore */
  }
  return href.startsWith("http") ? href : "";
}

async function duckLite(q: string): Promise<string> {
  const url =
    "https://api.duckduckgo.com/?q=" +
    encodeURIComponent(q) +
    "&format=json&no_html=1&skip_disambig=1";
  try {
    const raw = await fetchText(url, 10000);
    const j = JSON.parse(raw) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: { Text?: string; FirstURL?: string }[];
    };
    const lines: string[] = [];
    if (j.Heading || j.AbstractText) {
      lines.push(
        (j.Heading || "Result") + (j.AbstractURL ? " — " + j.AbstractURL : ""),
      );
      if (j.AbstractText) lines.push(j.AbstractText);
    }
    for (const t of j.RelatedTopics || []) {
      if (t.Text)
        lines.push("- " + t.Text + (t.FirstURL ? " (" + t.FirstURL + ")" : ""));
      if (lines.length >= 8) break;
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}

async function fetchText(url: string, ms: number): Promise<string> {
  if (!isPublicHttp(url)) throw new Error("Blocked URL");
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/json,*/*;q=0.8",
      },
      redirect: "follow",
      signal: ac.signal,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > 200000 ? buf.slice(0, 200000) : buf;
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } finally {
    clearTimeout(t);
  }
}

function isPublicHttp(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h === "0.0.0.0")
      return false;
    if (h.startsWith("169.254.") || h === "metadata.google.internal")
      return false;
    if (/^(127|10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

function removeTagBlock(html: string, tag: string): string {
  const openTag = `<${tag}`;
  const closeTag = `</${tag}>`;
  let res = html;
  let start = res.toLowerCase().indexOf(openTag);
  while (start !== -1) {
    const end = res.toLowerCase().indexOf(closeTag, start);
    if (end === -1) break;
    res = res.slice(0, start) + " " + res.slice(end + closeTag.length);
    start = res.toLowerCase().indexOf(openTag);
  }
  return res;
}

function stripTags(html: string): string {
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
  return res;
}

function stripHtml(s: string): string {
  const noScript = removeTagBlock(String(s || ""), "script");
  const noStyle = removeTagBlock(noScript, "style");
  return decodeEntities(stripTags(noStyle).replace(/\s+/g, " ").trim());
}

function decodeEntities(s: string): string {
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}
