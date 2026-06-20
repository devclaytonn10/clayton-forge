import type { LLMConfig } from "../schema/agent.schema";

// ─────────────────────────────────────────────
// Request / Response
// ─────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

// ─────────────────────────────────────────────
// Adapter Interface
// ─────────────────────────────────────────────

export interface LLMAdapter {
  readonly provider: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
}

// ─────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────

export async function createAdapter(config: LLMConfig): Promise<LLMAdapter> {
  switch (config.provider) {
    case "anthropic": {
      const { AnthropicAdapter } = await import("./anthropic.adapter");
      return new AnthropicAdapter(config);
    }
    case "openai":
    case "openai-compatible":
    case "lmstudio": {
      const { OpenAIAdapter } = await import("./openai.adapter");
      return new OpenAIAdapter(config);
    }
    case "ollama": {
      const { OllamaAdapter } = await import("./ollama.adapter");
      return new OllamaAdapter(config);
    }
    case "none": {
      const { NoneAdapter } = await import("./none.adapter");
      return new NoneAdapter();
    }
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
