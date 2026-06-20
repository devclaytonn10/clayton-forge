import { z } from "zod";

// ─────────────────────────────────────────────
// LLM Provider Schema
// ─────────────────────────────────────────────

export const LLMProviderSchema = z.enum([
  "anthropic",
  "openai",
  "gemini",
  "ollama",
  "lmstudio",
  "openai-compatible",
  "none",
]);

export type LLMProvider = z.infer<typeof LLMProviderSchema>;

export const LLMConfigSchema = z.object({
  provider: LLMProviderSchema,
  model: z.string().optional(),
  api_key: z.string().optional(),
  base_url: z.string().url().optional().or(z.literal("")),
  temperature: z.number().min(0).max(2).default(0.1),
  max_tokens: z.number().positive().default(1000),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

// ─────────────────────────────────────────────
// Trigger Schema
// ─────────────────────────────────────────────

export const TriggerTypeSchema = z.enum([
  "webhook",
  "schedule",
  "event",
  "manual",
]);

export const TriggerSchema = z.object({
  type: TriggerTypeSchema,
  endpoint: z.string().optional(),
  cron: z.string().optional(),
  event: z.string().optional(),
});

export type Trigger = z.infer<typeof TriggerSchema>;

// ─────────────────────────────────────────────
// Prompt Schema
// ─────────────────────────────────────────────

export const PromptVariableSchema = z.object({
  name: z.string(),
  required: z.boolean().default(true),
  description: z.string().optional(),
  default: z.string().optional(),
});

export const PromptSchema = z.object({
  system: z.string(),
  user_template: z.string().optional(),
  variables: z.array(PromptVariableSchema).default([]),
});

export type Prompt = z.infer<typeof PromptSchema>;

// ─────────────────────────────────────────────
// Output Schema
// ─────────────────────────────────────────────

export const OutputFormatSchema = z.enum(["json", "text", "markdown"]);

export const OutputSchema = z.object({
  format: OutputFormatSchema.default("text"),
  schema: z.record(z.string()).optional(),
});

export type Output = z.infer<typeof OutputSchema>;

// ─────────────────────────────────────────────
// Cost Schema
// ─────────────────────────────────────────────

export const CostSchema = z.object({
  limit_per_execution_usd: z.number().positive().optional(),
  limit_daily_usd: z.number().positive().optional(),
});

export type Cost = z.infer<typeof CostSchema>;

// ─────────────────────────────────────────────
// Agent Type
// ─────────────────────────────────────────────

export const AgentTypeSchema = z.enum([
  "reactive",       // recebe input → processa → responde
  "proactive",      // age por conta própria com base em gatilhos
  "orchestrator",   // coordena outros agentes
  "worker",         // executado por um orchestrator
  "pipeline",       // sequência linear de passos
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;

// ─────────────────────────────────────────────
// Trust Level
// ─────────────────────────────────────────────

export const TrustLevelSchema = z.union([
  z.literal(0), // sandboxed — sem acesso externo
  z.literal(1), // read-only — lê dados, não escreve
  z.literal(2), // write — lê e escreve
  z.literal(3), // admin — controle total
]);

export type TrustLevel = z.infer<typeof TrustLevelSchema>;

// ─────────────────────────────────────────────
// Agent Schema (completo)
// ─────────────────────────────────────────────

export const AgentSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must follow semver (e.g. 1.0.0)"),
  description: z.string().optional(),
  type: AgentTypeSchema.default("reactive"),
  trust_level: TrustLevelSchema.default(0),

  llm: LLMConfigSchema,
  trigger: TriggerSchema.optional(),
  prompt: PromptSchema,
  output: OutputSchema.default({ format: "text" }),
  cost: CostSchema.optional(),

  tags: z.array(z.string()).default([]),
  tests: z.array(z.object({ file: z.string() })).default([]),
});

export type Agent = z.infer<typeof AgentSchema>;

// ─────────────────────────────────────────────
// Test Schema (agent.test.yaml)
// ─────────────────────────────────────────────

export const TestCaseSchema = z.object({
  name: z.string(),
  input: z.record(z.string()),
  expected_output: z.string().optional(),
  expected_contains: z.array(z.string()).optional(),
  expected_not_contains: z.array(z.string()).optional(),
  timeout_ms: z.number().default(30000),
});

export const TestSuiteSchema = z.object({
  agent: z.string(),
  cases: z.array(TestCaseSchema),
});

export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestSuite = z.infer<typeof TestSuiteSchema>;
