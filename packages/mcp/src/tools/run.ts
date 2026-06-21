import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// forge_run
// Runs a Clayton Forge agent with a given input prompt.
// Calls the LLM directly from the MCP server process.
// ---------------------------------------------------------------------------

interface AgentConfig {
  name: string;
  description?: string;
  llm: {
    provider: "anthropic" | "openai" | "ollama" | "lmstudio" | "openai-compatible" | "none";
    model?: string;
    api_key?: string;
    base_url?: string;
  };
  system_prompt: string;
  max_tokens?: number;
  temperature?: number;
}

function loadAgentConfig(agentPath: string): AgentConfig | string {
  const absPath = path.resolve(agentPath);
  if (!fs.existsSync(absPath)) return `File not found: ${absPath}`;
  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    const parsed = yaml.load(raw) as AgentConfig;
    if (!parsed?.name || !parsed?.llm || !parsed?.system_prompt) {
      return "Invalid agent.yaml: missing required fields (name, llm, system_prompt)";
    }
    return parsed;
  } catch (e) {
    return `Failed to parse agent.yaml: ${String(e)}`;
  }
}

async function runWithAnthropic(config: AgentConfig, input: string): Promise<string> {
  const apiKey = config.llm.api_key ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No API key — set ANTHROPIC_API_KEY env var or add api_key to agent.yaml");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.llm.model ?? "claude-3-5-sonnet-20241022",
      max_tokens: config.max_tokens ?? 2048,
      system: config.system_prompt,
      messages: [{ role: "user", content: input }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  return data.content.filter(b => b.type === "text").map(b => b.text).join("");
}

async function runWithOpenAI(config: AgentConfig, input: string): Promise<string> {
  const apiKey = config.llm.api_key ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No API key — set OPENAI_API_KEY env var or add api_key to agent.yaml");

  const baseUrl = config.llm.base_url ?? "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.llm.model ?? "gpt-4o",
      max_tokens: config.max_tokens ?? 2048,
      temperature: config.temperature ?? 0.7,
      messages: [
        { role: "system", content: config.system_prompt },
        { role: "user", content: input },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? "(empty response)";
}

async function runWithOllama(config: AgentConfig, input: string): Promise<string> {
  const baseUrl = config.llm.base_url ?? "http://localhost:11434";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.llm.model ?? "llama3.2",
      stream: false,
      messages: [
        { role: "system", content: config.system_prompt },
        { role: "user", content: input },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error ${response.status}: ${err}. Is Ollama running? Try: ollama serve`);
  }

  const data = await response.json() as { message: { content: string } };
  return data.message?.content ?? "(empty response)";
}

async function runAgent(config: AgentConfig, input: string): Promise<string> {
  switch (config.llm.provider) {
    case "anthropic":
      return runWithAnthropic(config, input);
    case "openai":
    case "openai-compatible":
    case "lmstudio":
      return runWithOpenAI(config, input);
    case "ollama":
      return runWithOllama(config, input);
    case "none":
      return `[Rule-based agent — no LLM configured]\nSystem prompt: ${config.system_prompt}\nInput: ${input}`;
    default:
      throw new Error(`Unknown LLM provider: ${config.llm.provider}`);
  }
}

export function registerRunTool(server: McpServer): void {
  server.registerTool(
    "forge_run",
    {
      title: "Run Agent",
      description: `Run a Clayton Forge agent with a given input prompt.

Loads the agent.yaml, calls the configured LLM, and returns the response.

Supported providers:
- anthropic  → needs ANTHROPIC_API_KEY env var
- openai     → needs OPENAI_API_KEY env var
- ollama     → needs Ollama running locally (http://localhost:11434)
- lmstudio   → needs LM Studio running locally
- none       → rule-based, no LLM call

Args:
  - input (string): The prompt to send to the agent
  - agent_path (string): Path to agent.yaml (default: "./agent.yaml")

Returns:
  The agent's response text.

Examples:
  - "Ask my agent to summarize a document" → input="Summarize: ...", agent_path="./agent.yaml"
  - "Run the support agent" → input="My order hasn't arrived", agent_path="./agents/support/agent.yaml"

Error handling:
  - Returns clear error if agent.yaml not found or invalid
  - Returns API error message if LLM call fails
  - Returns hint if API key is missing`,
      inputSchema: z.object({
        input: z.string()
          .min(1)
          .max(32000)
          .describe("The prompt/question to send to the agent"),
        agent_path: z.string()
          .default("./agent.yaml")
          .describe("Path to the agent.yaml configuration file"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ input, agent_path }) => {
      const configOrError = loadAgentConfig(agent_path);
      if (typeof configOrError === "string") {
        return {
          content: [{ type: "text", text: `❌ ${configOrError}` }],
          structuredContent: { success: false, error: configOrError },
        };
      }

      const config = configOrError;

      try {
        const startMs = Date.now();
        const output = await runAgent(config, input);
        const elapsedMs = Date.now() - startMs;

        return {
          content: [{ type: "text", text: output }],
          structuredContent: {
            success: true,
            agent_name: config.name,
            provider: config.llm.provider,
            model: config.llm.model ?? "default",
            elapsed_ms: elapsedMs,
            output,
          },
        };
      } catch (e) {
        const errorMsg = String(e instanceof Error ? e.message : e);
        return {
          content: [{ type: "text", text: `❌ Agent run failed: ${errorMsg}` }],
          structuredContent: { success: false, error: errorMsg },
        };
      }
    }
  );
}
