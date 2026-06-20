import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { AgentSchema, TestSuiteSchema, type Agent, type TestSuite } from "./agent.schema";

// ─────────────────────────────────────────────
// Resolver de variáveis de ambiente
// ex: "${ANTHROPIC_API_KEY}" → process.env.ANTHROPIC_API_KEY
// ─────────────────────────────────────────────

function resolveEnvVars(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj.replace(/\$\{([^}]+)\}/g, (_, key) => {
      return process.env[key] ?? `\${${key}}`;
    });
  }
  if (Array.isArray(obj)) return obj.map(resolveEnvVars);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, resolveEnvVars(v)])
    );
  }
  return obj;
}

// ─────────────────────────────────────────────
// Parse Agent
// ─────────────────────────────────────────────

export function parseAgentFile(filePath: string): Agent {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`agent.yaml not found at: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  const parsed = yaml.load(raw);
  const withEnv = resolveEnvVars(parsed);

  const result = AgentSchema.safeParse(withEnv);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")} — ${i.message}`)
      .join("\n");
    throw new Error(`Invalid agent.yaml:\n${issues}`);
  }

  return result.data;
}

// ─────────────────────────────────────────────
// Parse Test Suite
// ─────────────────────────────────────────────

export function parseTestFile(filePath: string): TestSuite {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Test file not found at: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  const parsed = yaml.load(raw);

  const result = TestSuiteSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")} — ${i.message}`)
      .join("\n");
    throw new Error(`Invalid test file:\n${issues}`);
  }

  return result.data;
}

// ─────────────────────────────────────────────
// Find agent.yaml walking up from cwd
// ─────────────────────────────────────────────

export function findAgentFile(startDir: string = process.cwd()): string | null {
  let current = startDir;

  while (true) {
    const candidate = path.join(current, "agent.yaml");
    if (fs.existsSync(candidate)) return candidate;

    const parent = path.dirname(current);
    if (parent === current) return null; // chegou na raiz
    current = parent;
  }
}
