import type { Agent } from "../schema/agent.schema";
import { createAdapter } from "../adapters/base.adapter";
import type { LLMMessage, LLMResponse } from "../adapters/base.adapter";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ExecutionInput {
  variables: Record<string, string>;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  parsed?: unknown;       // se output.format === "json"
  llm_response?: LLMResponse;
  error?: string;
  duration_ms: number;
}

// ─────────────────────────────────────────────
// Template resolver
// ─────────────────────────────────────────────

function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const value = vars[key.trim()];
    if (value === undefined) {
      throw new Error(`Missing required variable: "${key.trim()}"`);
    }
    return value;
  });
}

// ─────────────────────────────────────────────
// Validate input against agent schema
// ─────────────────────────────────────────────

function validateInput(agent: Agent, input: ExecutionInput): void {
  for (const variable of agent.prompt.variables) {
    if (variable.required && !(variable.name in input.variables)) {
      if (!variable.default) {
        throw new Error(
          `Missing required variable: "${variable.name}"${
            variable.description ? ` (${variable.description})` : ""
          }`
        );
      }
    }
  }
}

// ─────────────────────────────────────────────
// Parse JSON output safely
// ─────────────────────────────────────────────

function tryParseJSON(content: string): unknown {
  // Remove markdown code fences if present
  const clean = content.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Executor
// ─────────────────────────────────────────────

export async function executeAgent(
  agent: Agent,
  input: ExecutionInput
): Promise<ExecutionResult> {
  const start = Date.now();

  try {
    // 1. Validate input
    validateInput(agent, input);

    // Merge defaults
    const vars: Record<string, string> = {};
    for (const variable of agent.prompt.variables) {
      if (variable.default && !(variable.name in input.variables)) {
        vars[variable.name] = variable.default;
      }
    }
    const mergedVars = { ...vars, ...input.variables };

    // 2. Build messages
    const messages: LLMMessage[] = [];

    messages.push({
      role: "system",
      content: resolveTemplate(agent.prompt.system, mergedVars),
    });

    if (agent.prompt.user_template) {
      messages.push({
        role: "user",
        content: resolveTemplate(agent.prompt.user_template, mergedVars),
      });
    } else if (mergedVars.input) {
      // Fallback: usa a variável "input" como user message
      messages.push({
        role: "user",
        content: mergedVars.input,
      });
    }

    // 3. Call LLM
    const adapter = await createAdapter(agent.llm);
    const llm_response = await adapter.complete({
      messages,
      temperature: agent.llm.temperature,
      max_tokens: agent.llm.max_tokens,
    });

    // 4. Parse output
    let parsed: unknown = undefined;
    if (agent.output.format === "json") {
      parsed = tryParseJSON(llm_response.content);
      if (parsed === null) {
        console.warn("⚠ Output format is JSON but response couldn't be parsed as JSON.");
      }
    }

    return {
      success: true,
      output: llm_response.content,
      parsed,
      llm_response,
      duration_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
      duration_ms: Date.now() - start,
    };
  }
}
