# clayton-forge-mcp

> MCP Server for [Clayton Forge](https://github.com/devclaytonn10/clayton-forge) — use AI agents from any MCP-compatible client.

Works with **Claude Code**, **Cursor**, **Windsurf**, **Continue.dev**, and any tool that supports the MCP protocol.

---

## Tools

| Tool | Description |
|---|---|
| `forge_new_agent` | Scaffold a new agent (agent.yaml + README) |
| `forge_validate` | Validate an agent.yaml without running it |
| `forge_list` | List all agents found in a directory |
| `forge_run` | Run an agent with a given prompt |
| `forge_test` | Run the agent's test suite (PASS/FAIL) |

---

## Installation

```bash
npm install -g clayton-forge-mcp
```

Or use `npx` without installing:
```bash
npx clayton-forge-mcp
```

---

## Client Configuration

### Claude Code

Add to your MCP config (`~/.claude/claude.json`):

```json
{
  "mcpServers": {
    "clayton-forge": {
      "command": "npx",
      "args": ["clayton-forge-mcp"]
    }
  }
}
```

Or if installed globally:
```json
{
  "mcpServers": {
    "clayton-forge": {
      "command": "clayton-forge-mcp"
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "clayton-forge": {
      "command": "npx",
      "args": ["clayton-forge-mcp"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "clayton-forge": {
      "command": "npx",
      "args": ["clayton-forge-mcp"]
    }
  }
}
```

### Continue.dev

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "npx",
          "args": ["clayton-forge-mcp"]
        }
      }
    ]
  }
}
```

---

## Usage Examples

Once configured, you can use natural language in your MCP client:

```
Create a new agent for customer support
→ Calls forge_new_agent with name="customer-support"

Validate my agent.yaml
→ Calls forge_validate with agent_path="./agent.yaml"

List all agents in my projects folder
→ Calls forge_list with search_dir="./projects"

Run my agent with "What's the refund policy?"
→ Calls forge_run with input="What's the refund policy?"

Run all tests for this agent
→ Calls forge_test
```

---

## Environment Variables

| Variable | Required for |
|---|---|
| `ANTHROPIC_API_KEY` | Agents using `provider: anthropic` |
| `OPENAI_API_KEY` | Agents using `provider: openai` |
| `TRANSPORT` | Set to `http` to run as HTTP server instead of stdio |
| `PORT` | HTTP port (default: 3000, only used when `TRANSPORT=http`) |

---

## HTTP Mode

For remote deployment or multi-client use:

```bash
TRANSPORT=http PORT=3000 clayton-forge-mcp
```

Endpoint: `POST http://localhost:3000/mcp`

---

## Part of Clayton Forge

- `clayton-forge` — CLI (`cforge` command)
- `clayton-forge-core` — Core engine (LLM adapters, executor, test runner)
- `clayton-forge-mcp` — **This package** — MCP server

[GitHub](https://github.com/devclaytonn10/clayton-forge) · [npm](https://www.npmjs.com/package/clayton-forge-mcp) · MIT License
