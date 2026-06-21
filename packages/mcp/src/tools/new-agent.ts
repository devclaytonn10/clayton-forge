import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// forge_new_agent
// Creates a new agent scaffold (agent.yaml + README) in the current directory
// ---------------------------------------------------------------------------

const AgentYamlTemplate = (name: string, description: string, llm: string): string => `# Clayton Forge Agent
name: "${name}"
version: "0.1.0"
description: "${description}"

llm:
  provider: "${llm}"
  model: "${llm === "anthropic" ? "claude-3-5-sonnet-20241022" : llm === "openai" ? "gpt-4o" : "llama3.2"}"
  # api_key: "your-key-here"  # or set ANTHROPIC_API_KEY / OPENAI_API_KEY env var

system_prompt: |
  You are ${name}, an AI agent created with Clayton Forge.
  ${description}
  
  Be concise, helpful, and accurate.

max_tokens: 2048
temperature: 0.7

tests:
  - name: "basic_response"
    input: "Hello, what can you do?"
    expect_contains: ["help", "assist"]
`;

const AgentReadmeTemplate = (name: string, description: string): string => `# ${name}

${description}

## Usage

\`\`\`bash
# Run interactively
cforge run

# Run with input
cforge run --input "your prompt here"

# Run tests
cforge test
\`\`\`

## Configuration

Edit \`agent.yaml\` to change the LLM provider, model, system prompt, or tests.

## Created with

[Clayton Forge](https://github.com/devclaytonn10/clayton-forge) — AI Agent Platform
`;

export function registerNewAgentTool(server: McpServer): void {
  server.registerTool(
    "forge_new_agent",
    {
      title: "New Agent",
      description: `Create a new Clayton Forge agent scaffold in the specified directory.

Generates two files:
- agent.yaml  — agent configuration (LLM, system prompt, tests)
- README.md   — usage instructions

This is the equivalent of running \`cforge new\` from the CLI.

Args:
  - name (string): Agent name, e.g. "my-support-bot"
  - description (string): What the agent does, e.g. "Answers customer support questions"
  - llm (string): LLM provider — "anthropic", "openai", or "ollama" (default: "anthropic")
  - output_dir (string): Directory to create the agent in (default: "./<name>")

Returns:
  Confirmation message with the paths of files created.

Examples:
  - "Create a support agent" → name="support-agent", description="Handles support tickets", llm="anthropic"
  - "New agent for code review" → name="code-reviewer", llm="openai"`,
      inputSchema: z.object({
        name: z.string()
          .min(1)
          .max(64)
          .regex(/^[a-z0-9-]+$/, "Name must be lowercase letters, numbers, and hyphens only")
          .describe("Agent name (lowercase, hyphens allowed), e.g. 'my-support-bot'"),
        description: z.string()
          .min(1)
          .max(256)
          .describe("What this agent does"),
        llm: z.enum(["anthropic", "openai", "ollama", "none"])
          .default("anthropic")
          .describe("LLM provider: anthropic, openai, ollama, or none (rule-based)"),
        output_dir: z.string()
          .optional()
          .describe("Output directory. Defaults to ./<name>"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, description, llm, output_dir }) => {
      const targetDir = output_dir ?? `./${name}`;
      const absDir = path.resolve(targetDir);

      if (fs.existsSync(absDir)) {
        const existing = fs.readdirSync(absDir);
        if (existing.includes("agent.yaml")) {
          return {
            content: [{
              type: "text",
              text: `❌ Error: agent.yaml already exists in ${absDir}. Choose a different output_dir or delete the existing file.`,
            }],
          };
        }
      } else {
        fs.mkdirSync(absDir, { recursive: true });
      }

      const yamlContent = AgentYamlTemplate(name, description, llm);
      const readmeContent = AgentReadmeTemplate(name, description);

      const yamlPath = path.join(absDir, "agent.yaml");
      const readmePath = path.join(absDir, "README.md");

      fs.writeFileSync(yamlPath, yamlContent, "utf-8");
      fs.writeFileSync(readmePath, readmeContent, "utf-8");

      const result = {
        success: true,
        agent_name: name,
        output_dir: absDir,
        files_created: [yamlPath, readmePath],
        next_steps: [
          `cd ${targetDir}`,
          "# Set your API key (e.g. export ANTHROPIC_API_KEY=sk-...)",
          "cforge run",
          "cforge test",
        ],
      };

      return {
        content: [{
          type: "text",
          text: [
            `✅ Agent "${name}" created successfully!`,
            ``,
            `📁 Location: ${absDir}`,
            `📄 Files:`,
            `   • agent.yaml  — configure LLM, system prompt, tests`,
            `   • README.md   — usage instructions`,
            ``,
            `🚀 Next steps:`,
            ...result.next_steps.map(s => `   ${s}`),
          ].join("\n"),
        }],
        structuredContent: result,
      };
    }
  );
}
