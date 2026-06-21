#!/usr/bin/env node
/**
 * Clayton Forge MCP Server
 *
 * Exposes Clayton Forge tools to any MCP-compatible client:
 *   - Claude Code, Cursor, Windsurf, Continue.dev, etc.
 *
 * Transport: stdio (default) | HTTP (set TRANSPORT=http PORT=3000)
 *
 * Tools:
 *   forge_new_agent  — scaffold a new agent
 *   forge_validate   — validate agent.yaml
 *   forge_list       — list agents in a directory
 *   forge_run        — run an agent with a prompt
 *   forge_test       — run the agent's test suite
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { registerNewAgentTool } from "./tools/new-agent.js";
import { registerValidateTool } from "./tools/validate.js";
import { registerListTool } from "./tools/list.js";
import { registerRunTool } from "./tools/run.js";
import { registerTestTool } from "./tools/test.js";

// ---------------------------------------------------------------------------
// Server initialization
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "clayton-forge-mcp-server",
  version: "0.1.0",
});

// Register all tools
registerNewAgentTool(server);
registerValidateTool(server);
registerListTool(server);
registerRunTool(server);
registerTestTool(server);

// ---------------------------------------------------------------------------
// Transport selection
// ---------------------------------------------------------------------------

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Silence all non-error console output (MCP stdio is strict)
}

async function runHTTP(): Promise<void> {
  // Lazy-load express only in HTTP mode
  const express = (await import("express")).default;
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "clayton-forge-mcp-server", version: "0.1.0" });
  });

  const port = parseInt(process.env.PORT ?? "3000", 10);
  app.listen(port, () => {
    console.error(`[Clayton Forge MCP] HTTP server running on http://localhost:${port}/mcp`);
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = process.env.TRANSPORT ?? "stdio";

if (transport === "http") {
  runHTTP().catch((err: unknown) => {
    console.error("[Clayton Forge MCP] Fatal error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err: unknown) => {
    console.error("[Clayton Forge MCP] Fatal error:", err);
    process.exit(1);
  });
}
