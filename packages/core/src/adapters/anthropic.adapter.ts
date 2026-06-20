import Anthropic from "@anthropic-ai/sdk";
import type { LLMConfig } from "../schema/agent.schema";
import type { LLMAdapter, LLMRequest, LLMResponse } from "./base.adapter";

export class AnthropicAdapter implements LLMAdapter {
  readonly provider = "anthropic";
  private client: Anthropic;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.api_key || process.env.ANTHROPIC_API_KEY,
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const systemMsg = request.messages.find((m) => m.role === "system");
    const userMessages = request.messages.filter((m) => m.role !== "system");

    const response = await this.client.messages.create({
      model: this.config.model || "claude-sonnet-4-6",
      max_tokens: request.max_tokens ?? this.config.max_tokens,
      temperature: request.temperature ?? this.config.temperature,
      system: systemMsg?.content,
      messages: userMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const content =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return {
      content,
      provider: "anthropic",
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}
