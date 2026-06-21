import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// forge_test
// Runs test cases defined in agent.yaml and reports PASS/FAIL
// ---------------------------------------------------------------------------

interface TestCase {
  name: string;
  input: string;
  expect_contains?: string[];
  expect_not_contains?: string[];
}

interface AgentConfig {
  name: string;
  llm: {
    provider: string;
    model?: string;
    api_key?: string;
    base_url?: string;
  };
  system_prompt: string;
  max_tokens?: number;
  temperature?: number;
  tests?: TestCase[];
}

function loadConfig(agentPath: string): AgentConfig | string {
  const absPath = path.resolve(agentPath);
  if (!fs.existsSync(absPath)) return `File not found: ${absPath}`;
  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    return yaml.load(raw) as AgentConfig;
  } catch (e) {
    return `YAML parse error: ${String(e)}`;
  }
}

async function callLLM(config: AgentConfig, input: string): Promise<string> {
  const provider = config.llm.provider;

  if (provider === "anthropic") {
    const apiKey = config.llm.api_key ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: config.llm.model ?? "claude-3-5-sonnet-20241022",
        max_tokens: config.max_tokens ?? 1024,
        system: config.system_prompt,
        messages: [{ role: "user", content: input }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json() as { content: Array<{ type: string; text: string }> };
    return data.content.filter(b => b.type === "text").map(b => b.text).join("");
  }

  if (provider === "openai" || provider === "openai-compatible" || provider === "lmstudio") {
    const apiKey = config.llm.api_key ?? process.env.OPENAI_API_KEY ?? "lm-studio";
    const baseUrl = config.llm.base_url ?? (provider === "lmstudio" ? "http://localhost:1234/v1" : "https://api.openai.com/v1");
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.llm.model ?? "gpt-4o",
        max_tokens: config.max_tokens ?? 1024,
        messages: [{ role: "system", content: config.system_prompt }, { role: "user", content: input }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content ?? "";
  }

  if (provider === "ollama") {
    const baseUrl = config.llm.base_url ?? "http://localhost:11434";
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.llm.model ?? "llama3.2", stream: false, messages: [{ role: "system", content: config.system_prompt }, { role: "user", content: input }] }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json() as { message: { content: string } };
    return data.message?.content ?? "";
  }

  if (provider === "none") return `[rule-based] input: ${input}`;

  throw new Error(`Unknown provider: ${provider}`);
}

interface TestResult {
  name: string;
  passed: boolean;
  output: string;
  failures: string[];
  error?: string;
}

async function runTest(config: AgentConfig, test: TestCase): Promise<TestResult> {
  let output = "";
  let error: string | undefined;
  const failures: string[] = [];

  try {
    output = await callLLM(config, test.input);
  } catch (e) {
    error = String(e instanceof Error ? e.message : e);
    return { name: test.name, passed: false, output: "", failures: [], error };
  }

  const outputLower = output.toLowerCase();

  for (const phrase of test.expect_contains ?? []) {
    if (!outputLower.includes(phrase.toLowerCase())) {
      failures.push(`Expected to contain: "${phrase}"`);
    }
  }
  for (const phrase of test.expect_not_contains ?? []) {
    if (outputLower.includes(phrase.toLowerCase())) {
      failures.push(`Expected NOT to contain: "${phrase}"`);
    }
  }

  return { name: test.name, passed: failures.length === 0, output, failures };
}

export function registerTestTool(server: McpServer): void {
  server.registerTool(
    "forge_test",
    {
      title: "Test Agent",
      description: `Run the test suite defined in an agent.yaml file.

For each test case, sends the test input to the agent and checks:
- expect_contains: response must include these strings (case-insensitive)
- expect_not_contains: response must NOT include these strings

Reports PASS/FAIL for each test with failure details.

Args:
  - agent_path (string): Path to agent.yaml (default: "./agent.yaml")
  - test_name (string): Run only a specific test by name (optional — default runs all)

Returns:
  Test results with PASS/FAIL per test and a summary.

Examples:
  - "Run all tests" → agent_path="./agent.yaml"
  - "Run just the basic_response test" → test_name="basic_response"

Notes:
  - Requires a valid LLM API key (same as forge_run)
  - Tests with no expect_contains / expect_not_contains always PASS if LLM responds`,
      inputSchema: z.object({
        agent_path: z.string()
          .default("./agent.yaml")
          .describe("Path to the agent.yaml file"),
        test_name: z.string()
          .optional()
          .describe("Run only this specific test (by name). Omit to run all tests."),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ agent_path, test_name }) => {
      const configOrError = loadConfig(agent_path);
      if (typeof configOrError === "string") {
        return {
          content: [{ type: "text", text: `❌ ${configOrError}` }],
          structuredContent: { success: false, error: configOrError },
        };
      }

      const config = configOrError;
      const allTests: TestCase[] = config.tests ?? [];

      if (allTests.length === 0) {
        return {
          content: [{ type: "text", text: `⚠️  No tests defined in ${path.resolve(agent_path)}.\n\nAdd a 'tests:' section to agent.yaml to define test cases.` }],
          structuredContent: { success: true, total: 0, passed: 0, failed: 0, results: [] },
        };
      }

      const testsToRun = test_name
        ? allTests.filter(t => t.name === test_name)
        : allTests;

      if (testsToRun.length === 0) {
        return {
          content: [{ type: "text", text: `❌ No test named "${test_name}" found. Available: ${allTests.map(t => t.name).join(", ")}` }],
          structuredContent: { success: false, error: `Test "${test_name}" not found` },
        };
      }

      const results: TestResult[] = [];
      for (const test of testsToRun) {
        results.push(await runTest(config, test));
      }

      const passed = results.filter(r => r.passed).length;
      const failed = results.length - passed;

      const lines: string[] = [
        `🧪 Test results for "${config.name}":`,
        "",
      ];

      for (const r of results) {
        const icon = r.passed ? "✅" : "❌";
        lines.push(`${icon} ${r.name}`);
        if (r.error) lines.push(`   Error: ${r.error}`);
        if (r.failures.length > 0) r.failures.forEach(f => lines.push(`   • ${f}`));
      }

      lines.push("");
      lines.push(`─────────────────────────────`);
      lines.push(`Total: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed}`);
      if (failed === 0) lines.push(`\n🎉 All tests passed!`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: {
          success: true,
          total: results.length,
          passed,
          failed,
          results,
        },
      };
    }
  );
}
