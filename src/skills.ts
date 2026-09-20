import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

export interface SkillInfo {
  name: string;
  description: string;
  body: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  body: string;
  builtin: boolean;
}

const LANG_LOCK =
  "Never reply in Chinese (中文, 简体, or 繁體). Default language is English. Use Bahasa Indonesia only when the user writes Indonesian.";

export function builtinSkills(): SkillInfo[] {
  return [
    {
      name: "superpowers:systematic-debugging",
      description:
        "Root cause investigation across 4 phases: Investigate, Analyze, Hypothesize, Fix & Verify. Never guess blindly.",
      body: "Phase 1: Reproduce and isolate the exact defect with minimal test.\nPhase 2: Analyze execution flow and data states to find root cause.\nPhase 3: Formulate a single, minimal hypothesis addressing the root cause.\nPhase 4: Implement minimal fix, verify against test, ensure no regressions.",
    },
    {
      name: "superpowers:test-driven-development",
      description:
        "Red-Green-Refactor development cycle. Verify failure before writing implementation.",
      body: "1. Red: Write a concise failing test/assertion for the new behavior.\n2. Verify: Run the test to confirm it fails for the expected reason.\n3. Green: Write the minimal code to pass.\n4. Refactor: Clean up code while keeping tests green.",
    },
    {
      name: "superpowers:verification-before-completion",
      description:
        "Evidence before assertions. Always run build, test, and typecheck before claiming done.",
      body: "Never claim code is fixed, tests pass, or feature is complete without running verification commands and confirming actual terminal output and exit code 0.",
    },
    {
      name: "agent-skills:code-simplification",
      description:
        "Strip cognitive complexity, remove redundant layers, keep code readable and maintainable.",
      body: "Simplify logic for clarity without altering behavior. Remove dead code, avoid over-engineering, and keep functions focused on a single responsibility.",
    },
  ];
}

export function builtinAgents(): AgentInfo[] {
  return [
    {
      id: "code",
      name: "Code",
      description: "Implement and edit code",
      body: "",
      builtin: true,
    },
    {
      id: "plan",
      name: "Plan",
      description: "Architecture and implementation plan",
      body: "",
      builtin: true,
    },
    {
      id: "ask",
      name: "Ask",
      description: "Answer without changing files",
      body: "",
      builtin: true,
    },
    {
      id: "debug",
      name: "Debug",
      description: "Trace and fix defects",
      body: "",
      builtin: true,
    },
    {
      id: "review",
      name: "Review",
      description: "Review quality, security, tests",
      body: "",
      builtin: true,
    },
    {
      id: "arch",
      name: "Arch",
      description: "System architecture design and ADRs",
      body: "",
      builtin: true,
    },
  ];
}

/** Look up a skill by name (exact or prefix match). Used for @skill: mention injection. */
export function lookupSkill(
  name: string,
  extras: { skills: SkillInfo[] },
): SkillInfo | undefined {
  const q = name.toLowerCase().trim();
  return (
    extras.skills.find((s) => s.name.toLowerCase() === q) ||
    extras.skills.find((s) => s.name.toLowerCase().includes(q))
  );
}

export function loadWorkspaceExtras(): {
  skills: SkillInfo[];
  agents: AgentInfo[];
} {
  const roots: string[] = [];
  for (const f of vscode.workspace.workspaceFolders || []) {
    if (f.uri?.scheme === "file" && f.uri.fsPath) {
      roots.push(f.uri.fsPath);
    }
  }
  roots.push(os.homedir());
  const skills: SkillInfo[] = builtinSkills();
  const agents: AgentInfo[] = builtinAgents();
  const seenS = new Set<string>(skills.map((s) => s.name));
  const seenA = new Set<string>(agents.map((a) => a.id));

  const skillDirs = [
    // 1. Antigravity Superpowers Methodology & Core Agent Skills
    ".gemini/config/plugins/superpowers/skills",
    ".gemini/config/plugins/agent-skills/skills",
    ".gemini/config/skills",
    // 2. Workspace & Global Antigravity / Agy Roots
    ".antigravity/skills",
    ".agy/skills",
    ".agents/skills",
    ".bailucode/skills",
    // 3. Antigravity 300+ Skills Catalog
    ".gemini/config/plugins/antigravity-skills-manager/skills",
    // 4. Compatibility paths
    ".kilo/skills",
    ".kilocode/skills",
    ".grok/skills",
  ];
  const agentDirs = [
    // Antigravity & Agent Personas (Global & Local)
    ".gemini/config/plugins/agent-skills/agents",
    ".gemini/config/agents",
    ".antigravity/agents",
    ".agy/agents",
    ".agents/agents",
    ".agents",
    ".bailucode/agents",
    ".kilo/agents",
    ".kilo/agent",
    ".kilocode/agents",
  ];

  for (const root of roots) {
    for (const rel of skillDirs) {
      collectSkills(path.join(root, rel), skills, seenS);
    }
    for (const rel of agentDirs) {
      collectAgents(path.join(root, rel), agents, seenA);
    }
  }
  return { skills, agents };
}

function collectSkills(dir: string, out: SkillInfo[], seen: Set<string>): void {
  if (!safeDir(dir)) return;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    /* ignore unreadable directory */
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const file = path.join(dir, e.name, "SKILL.md");
    if (!safeFile(file)) continue;
    const raw = readCapped(file, 4000);
    if (!raw) continue;
    const meta = parseFront(raw);
    const name = meta.name || e.name;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      description: (meta.description || "").slice(0, 240),
      body: stripFront(raw).slice(0, 2500),
    });
    if (out.length >= 400) return;
  }
}

function collectAgents(dir: string, out: AgentInfo[], seen: Set<string>): void {
  if (!safeDir(dir)) return;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    /* ignore unreadable directory */
    return;
  }
  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith(".md")) continue;
    const file = path.join(dir, e.name);
    if (!safeFile(file)) continue;
    const raw = readCapped(file, 6000);
    if (!raw) continue;
    const meta = parseFront(raw);
    const id = (meta.name || e.name.replace(/\.md$/i, ""))
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: meta.name || e.name.replace(/\.md$/i, ""),
      description: (meta.description || "").slice(0, 240),
      body: stripFront(raw).slice(0, 3500),
      builtin: false,
    });
    if (out.length >= 50) return;
  }
}

export function buildSystemPrompt(
  mode: string,
  locale: string,
  extras: { skills: SkillInfo[]; agents: AgentInfo[] },
  basePrompt: string,
): string {
  const parts = [LANG_LOCK, basePrompt];
  const custom = extras.agents.find((a) => a.id === mode && !a.builtin);
  if (custom?.body) {
    parts.push(`Custom Agent Persona (${custom.name}):\n${custom.body}`);
  }
  if (mode === "debug") {
    parts.push(
      "Debug agent: execute Antigravity 4-phase systematic debugging (Investigate, Analyze, Hypothesize, Fix & Verify). Isolate defects with evidence and propose minimal verified fixes.",
    );
  }
  if (mode === "review") {
    parts.push(
      "Review agent: execute Antigravity 5-dimension review (Correctness, Readability, Architecture, Security, Performance). List findings prioritized by severity.",
    );
  }
  if (mode === "arch") {
    parts.push(
      "Architect agent: design systems using Antigravity architecture patterns. Produce C4 Context/Container/Component diagrams in Mermaid, Architecture Decision Records (ADRs), and component boundary definitions. Apply Clean Architecture, Hexagonal Architecture, or Domain-Driven Design as appropriate. Focus on scalability, maintainability, and testability.",
    );
  }
  if (extras.skills.length) {
    const primary = extras.skills.slice(0, 16);
    const catalog = primary
      .map(
        (s) => "- " + s.name + ": " + (s.description || s.body.slice(0, 100)),
      )
      .join("\n");
    let summary = `Antigravity & Agent Skills Vault (${extras.skills.length} available skills):\n${catalog}`;
    if (extras.skills.length > 16) {
      const more = extras.skills
        .slice(16, 75)
        .map((s) => s.name)
        .join(", ");
      const moreSuffix =
        extras.skills.length > 75
          ? ` ...and ${extras.skills.length - 75} more`
          : "";
      summary += `\n- Additional specialized skills: ${more}${moreSuffix}`;
    }
    parts.push(summary);

    const top = extras.skills
      .slice(0, 4)
      .map((s) => `## Skill: ${s.name}\n${s.body}`)
      .join("\n\n");
    if (top) parts.push(top.slice(0, 4000));
  }
  if (locale === "id") {
    parts.push(
      "The UI language is Indonesian. Prefer Bahasa Indonesia in replies.",
    );
  } else {
    parts.push("The UI language is English. Prefer English in replies.");
  }
  return parts.join("\n\n");
}

function parseFront(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw.startsWith("---")) return out;
  const endIdx = raw.indexOf("\n---", 3);
  if (endIdx === -1) return out;
  const block = raw.slice(3, endIdx);
  for (const line of block.split("\n")) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (k) out[k] = v;
  }
  return out;
}

function stripFront(raw: string): string {
  if (!raw.startsWith("---")) return raw.trim();
  const endIdx = raw.indexOf("\n---", 3);
  if (endIdx === -1) return raw.trim();
  return raw
    .slice(endIdx + 4)
    .replace(/^\s*/, "")
    .trim();
}

function readCapped(file: string, max: number): string {
  try {
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > 200000) return "";
    return fs.readFileSync(file, "utf8").slice(0, max);
  } catch {
    /* ignore unreadable file */
    return "";
  }
}

function safeDir(dir: string): boolean {
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    /* ignore filesystem error */
    return false;
  }
}

function safeFile(file: string): boolean {
  try {
    const st = fs.statSync(file);
    return st.isFile() && st.size > 0 && st.size < 200000;
  } catch {
    /* ignore filesystem error */
    return false;
  }
}
