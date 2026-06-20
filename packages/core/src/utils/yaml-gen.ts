import * as yaml from "js-yaml";
import type { Agent } from "../schema/agent.schema";

/**
 * Serializa um objeto Agent para string YAML.
 * Usado pelo wizard `cforge new` para gravar o agent.yaml.
 */
export function agentToYaml(agent: Partial<Agent>): string {
  return yaml.dump(agent, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
}

/**
 * Gera um agent.yaml de exemplo para uso em templates.
 */
export function generateExampleAgentYaml(overrides: Partial<Agent> = {}): string {
  const example: Partial<Agent> = {
    name: overrides.name ?? "my-agent",
    version: overrides.version ?? "1.0.0",
    description: overrides.description ?? "What does this agent do?",
    type: overrides.type ?? "reactive",
    trust_level: overrides.trust_level ?? 0,
    llm: overrides.llm ?? {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      api_key: "${ANTHROPIC_API_KEY}",
      temperature: 0.1,
      max_tokens: 1000,
    },
    prompt: overrides.prompt ?? {
      system: "You are a helpful assistant. {{context}}",
      user_template: "{{input}}",
      variables: [
        { name: "input", required: true, description: "The user's input" },
        { name: "context", required: false, default: "" },
      ],
    },
    output: overrides.output ?? {
      format: "text",
    },
    tags: overrides.tags ?? [],
    tests: [{ file: "agent.test.yaml" }],
  };

  return agentToYaml(example);
}

/**
 * Gera um agent.test.yaml de exemplo.
 */
export function generateExampleTestYaml(agentName: string): string {
  const example = {
    agent: agentName,
    cases: [
      {
        name: "basic response",
        input: { input: "Hello, world!" },
        expected_contains: ["Hello"],
        timeout_ms: 30000,
      },
    ],
  };

  return yaml.dump(example, { indent: 2 });
}
