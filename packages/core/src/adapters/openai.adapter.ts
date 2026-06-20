import OpenAI from "openai";
import type { LLMConfig } from "../schema/agent.schema";
import type { LLMAdapter, LLMRequest, LLMResponse } from "./base.adapter";

const PROVIDER_DEFAULTS: Record<string, { base_url: string; model: string }> = {
  lmstudio: { base_url: "http://localhost:1234/v1", model: "local-model" },
  "openai-compatible": { base_url: "http://localhost:8080/v1", model: "default" },
  openai: { base_url: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};

export class OpenAIAdapter implements LLMAdapter {
  readonly provider: string;
  private client: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.provider = config.provider;

    const defaults = PROVIDER_DEFAULTS[config.provider] ?? PROVIDER_DEFAULTS["openai"];

    this.client = new OpenAI({
      apiKey: config.api_key || process.env.OPENAI_API_KEY || "no-key",
      baseURL: config.base_url || defaults.base_url,
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const defaults = PROVIDER_DEFAULTS[this.config.provider] ?? PROVIDER_DEFAULTS["openai"];

    const response = await this.client.chat.completions.create({
      model: this.config.model || defaults.model,
      temperature: request.temperature ?? this.config.temperature,
      max_tokens: request.max_tokens ?? this.config.max_tokens,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const content = response.choices[0]?.message?.content ?? "";

    return {
      content,
      provider: this.provider,
      model: response.model,
      usage: {
        input_tokens: response.usage?.prompt_tokens,
        output_tokens: response.usage?.completion_tokens,
        total_tokens: response.usage?.total_tokens,
      },
    };
  }
}
