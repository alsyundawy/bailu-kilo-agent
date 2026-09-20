import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const HOME = path.join(os.homedir(), ".bailucode");

export interface HomeConfig {
  baseUrl?: string;
  model?: string;
  thinking?: string;
  mode?: string;
  locale?: string;
  theme?: string;
  bookmarks?: string[];
  tinyfishApiKey?: string;
  [key: string]: unknown;
}

export interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  last_model: string;
  updated: string;
  lifetime_prompt?: number;
  lifetime_completion?: number;
}

export function homeDir(): string {
  return HOME;
}

export function ensureHome(): string {
  const dirs = [HOME, path.join(HOME, "skills"), path.join(HOME, "agents"), path.join(HOME, "config")];
  for (const d of dirs) {
    try {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true, mode: 0o700 });
      }
    } catch {
      /* ignore directory creation errors */
    }
  }
  const readme = path.join(HOME, "README.md");
  if (!fs.existsSync(readme)) {
    try {
      fs.writeFileSync(
        readme,
        "# ~/.bailucode\n\nGlobal Bailu Agent home (survives extension updates).\n\n- config.json — model, theme, bookmarks, baseUrl, locale\n- usage.json — last token usage\n- skills/<name>/SKILL.md\n- agents/<name>.md\n",
        "utf8"
      );
    } catch {
      /* ignore file write errors */
    }
  }
  const cfg = path.join(HOME, "config.json");
  if (!fs.existsSync(cfg)) {
    try {
      fs.writeFileSync(cfg, JSON.stringify(defaultConfig(), null, 2), { encoding: "utf8", mode: 0o600 });
    } catch {
      /* ignore file write errors */
    }
  }
  return HOME;
}

export function defaultConfig(): HomeConfig {
  return {
    baseUrl: "https://bailucode.com/openapi/v1",
    model: "bailu-auto",
    thinking: "high",
    mode: "code",
    locale: "en",
    theme: "auto",
    bookmarks: ["bailu-auto"],
    tinyfishApiKey: ""
  };
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    const j = JSON.parse(raw) as unknown;
    return j && typeof j === "object" ? (j as T) : fallback;
  } catch {
    /* ignore json read / parse errors */
    return fallback;
  }
}

function writeJson(file: string, obj: unknown): void {
  ensureHome();
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), { encoding: "utf8", mode: 0o600 });
}

export function loadHomeConfig(): HomeConfig {
  ensureHome();
  const saved = readJson<Partial<HomeConfig> | null>(path.join(HOME, "config.json"), null);
  return saved ? { ...defaultConfig(), ...saved } : defaultConfig();
}

export function saveHomeConfig(partial?: Partial<HomeConfig>): HomeConfig {
  const cur = loadHomeConfig();
  const next: HomeConfig = partial ? { ...cur, ...partial } : cur;
  writeJson(path.join(HOME, "config.json"), next);
  return next;
}

export function loadUsage(): UsageData {
  ensureHome();
  return readJson<UsageData>(path.join(HOME, "usage.json"), {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    last_model: "",
    updated: ""
  });
}

export function saveUsage(u: Partial<UsageData>): UsageData {
  const prev = loadUsage();
  const next: UsageData = {
    prompt_tokens: Number(u.prompt_tokens || 0),
    completion_tokens: Number(u.completion_tokens || 0),
    total_tokens: Number(u.total_tokens || (Number(u.prompt_tokens || 0) + Number(u.completion_tokens || 0))),
    last_model: String(u.last_model || prev.last_model || ""),
    updated: new Date().toISOString(),
    lifetime_prompt: Number(prev.lifetime_prompt || 0) + Number(u.prompt_tokens || 0),
    lifetime_completion: Number(prev.lifetime_completion || 0) + Number(u.completion_tokens || 0)
  };
  writeJson(path.join(HOME, "usage.json"), next);
  return next;
}

export function skillRoots(): string[] {
  ensureHome();
  return [path.join(HOME, "skills")];
}

export function agentRoots(): string[] {
  ensureHome();
  return [path.join(HOME, "agents")];
}

/** Returns the path to the snapshots directory (~/.bailucode/snapshots). */
export function snapshotDir(): string {
  const dir = path.join(HOME, "snapshots");
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  } catch {
    /* ignore mkdir error */
  }
  return dir;
}
