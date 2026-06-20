import { Ollama } from "ollama";
import type { LLMConfig } from "../schema/agent.schema";
import type { LLMAdapter, LLMRequest, LLMResponse } from "./base.adapter";

export class OllamaAdapter implements LLMAdapter {
  readonly provider = "ollama";
  private client: Ollama;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.client = new Ollama({
      host: config.base_url || "http://localhost:11434",
    });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.chat({
      model: this.config.model || "llama3",
      options: {
        temperature: request.temperature ?? this.config.temperature,
        num_predict: request.max_tokens ?? this.config.max_tokens,
      },
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return {
      content: response.message.content,
      provider: "ollama",
      model: this.config.model || "llama3",
      usage: {
        input_tokens: response.prompt_eval_count,
        output_tokens: response.eval_count,
        total_tokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
      },
    };
  }
}
