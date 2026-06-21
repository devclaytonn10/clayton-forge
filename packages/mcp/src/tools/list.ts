import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// ---------------------------------------------------------------------------
// forge_list
// Scans a directory for agent.yaml files and returns a summary
// ---------------------------------------------------------------------------

interface AgentSummary {
  name: string;
  description: string;
  llm_provider: string;
  llm_model: string;
  test_count: number;
  path: string;
}

function scanForAgents(rootDir: string, maxDepth: number): AgentSummary[] {
  const agents: AgentSummary[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isFile() && entry.name === "agent.yaml") {
        try {
          const raw = fs.readFileSync(fullPath, "utf-8");
          const parsed = yaml.load(raw) as Record<string, unknown>;
          const llm = (parsed.llm as Record<string, string>) ?? {};
          agents.push({
            name: String(parsed.name ?? "unknown"),
            description: String(parsed.description ?? "No description"),
            llm_provider: String(llm.provider ?? "unknown"),
            llm_model: String(llm.model ?? "default"),
            test_count: Array.isArray(parsed.tests) ? parsed.tests.length : 0,
            path: fullPath,
          });
        } catch {
          // Skip malformed files
        }
      } else if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      }
    }
  }

  const absRoot = path.resolve(rootDir);
  if (!fs.existsSync(absRoot)) return [];
  walk(absRoot, 0);
  return agents;
}

export function registerListTool(server: McpServer): void {
  server.registerTool(
    "forge_list",
    {
      title: "List Agents",
      description: `Scan a directory and list all Clayton Forge agents found (files named agent.yaml).

For each agent found, shows:
- Name and description
- LLM provider and model
- Number of tests defined
- File path

Args:
  - search_dir (string): Directory to search (default: ".")
  - max_depth (number): How deep to recurse into subdirectories (default: 3)

Returns:
  List of agents found with their configurations.

Examples:
  - "List my agents" → search_dir="."
  - "Find agents in the projects folder" → search_dir="./projects"`,
      inputSchema: z.object({
        search_dir: z.string()
          .default(".")
          .describe("Root directory to search for agents"),
        max_depth: z.number()
          .int()
          .min(0)
          .max(10)
          .default(3)
          .describe("Maximum subdirectory depth to search"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ search_dir, max_depth }) => {
      const agents = scanForAgents(search_dir, max_depth);

      if (agents.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No Clayton Forge agents found in "${path.resolve(search_dir)}".\n\nCreate one with: forge_new_agent`,
          }],
          structuredContent: { agents: [], total: 0, search_dir: path.resolve(search_dir) },
        };
      }

      const lines: string[] = [
        `🤖 Found ${agents.length} agent${agents.length === 1 ? "" : "s"} in "${path.resolve(search_dir)}":`,
        "",
      ];

      agents.forEach((agent, i) => {
        lines.push(`${i + 1}. ${agent.name}`);
        lines.push(`   📝 ${agent.description}`);
        lines.push(`   🧠 ${agent.llm_provider}/${agent.llm_model}`);
        lines.push(`   🧪 ${agent.test_count} test${agent.test_count === 1 ? "" : "s"}`);
        lines.push(`   📁 ${agent.path}`);
        lines.push("");
      });

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: { agents, total: agents.length, search_dir: path.resolve(search_dir) },
      };
    }
  );
}
