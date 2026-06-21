import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// forge_validate
// Validates an agent.yaml without executing it
// ---------------------------------------------------------------------------

// Mirrors the core schema — lightweight version for MCP (no core dep needed here)
const AgentConfigSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  description: z.string().optional(),
  llm: z.object({
    provider: z.enum(["anthropic", "openai", "ollama", "lmstudio", "openai-compatible", "none"]),
    model: z.string().optional(),
    api_key: z.string().optional(),
    base_url: z.string().optional(),
  }),
  system_prompt: z.string().min(1),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  tests: z.array(z.object({
    name: z.string(),
    input: z.string(),
    expect_contains: z.array(z.string()).optional(),
    expect_not_contains: z.array(z.string()).optional(),
  })).optional(),
});

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  agent_name?: string;
  field_count: number;
};

function validateAgentFile(filePath: string): ValidationResult {
  const absPath = path.resolve(filePath);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!fs.existsSync(absPath)) {
    return { valid: false, errors: [`File not found: ${absPath}`], warnings, field_count: 0 };
  }

  let raw: string;
  try {
    raw = fs.readFileSync(absPath, "utf-8");
  } catch (e) {
    return { valid: false, errors: [`Cannot read file: ${absPath}`], warnings, field_count: 0 };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (e) {
    return { valid: false, errors: [`YAML parse error: ${String(e)}`], warnings, field_count: 0 };
  }

  const result = AgentConfigSchema.safeParse(parsed);
  if (!result.success) {
    const zodErrors = result.error.errors.map(e => `  ${e.path.join(".")}: ${e.message}`);
    return { valid: false, errors: zodErrors, warnings, field_count: 0 };
  }

  const config = result.data;

  // Warnings (non-blocking)
  if (!config.version) warnings.push("No 'version' field — consider adding version: '0.1.0'");
  if (!config.description) warnings.push("No 'description' field — add a short description of what this agent does");
  if (!config.tests || config.tests.length === 0) warnings.push("No tests defined — add at least one test case under 'tests:'");
  if (config.llm.provider !== "none" && !config.llm.model) warnings.push(`No 'model' specified for provider '${config.llm.provider}'`);

  const fieldCount = Object.keys(config).length;

  return {
    valid: true,
    errors: [],
    warnings,
    agent_name: config.name,
    field_count: fieldCount,
  };
}

export function registerValidateTool(server: McpServer): void {
  server.registerTool(
    "forge_validate",
    {
      title: "Validate Agent",
      description: `Validate a Clayton Forge agent.yaml file without running it.

Checks:
- YAML syntax is valid
- Required fields are present (name, llm, system_prompt)
- Field types and values are correct (e.g., valid LLM provider)
- Produces warnings for optional best practices (version, tests, description)

Does NOT execute the agent or call any LLM.

Args:
  - agent_path (string): Path to agent.yaml (default: "./agent.yaml")

Returns:
  Validation result with errors (blocking) and warnings (non-blocking).

Examples:
  - "Validate my agent" → agent_path="./agent.yaml"
  - "Check if this config is valid" → agent_path="./agents/support/agent.yaml"`,
      inputSchema: z.object({
        agent_path: z.string()
          .default("./agent.yaml")
          .describe("Path to the agent.yaml file to validate"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ agent_path }) => {
      const result = validateAgentFile(agent_path);

      const lines: string[] = [];

      if (result.valid) {
        lines.push(`✅ Valid agent: "${result.agent_name}"`);
        lines.push(`   Fields: ${result.field_count}`);
      } else {
        lines.push(`❌ Invalid agent: ${path.resolve(agent_path)}`);
        lines.push(`   ${result.errors.length} error(s) found:`);
        result.errors.forEach(e => lines.push(`   • ${e}`));
      }

      if (result.warnings.length > 0) {
        lines.push(``);
        lines.push(`⚠️  Warnings (${result.warnings.length}):`);
        result.warnings.forEach(w => lines.push(`   • ${w}`));
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: result,
      };
    }
  );
}
