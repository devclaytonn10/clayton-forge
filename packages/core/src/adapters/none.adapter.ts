import type { LLMAdapter, LLMRequest, LLMResponse } from "./base.adapter";

/**
 * NoneAdapter — usado quando provider é "none".
 * Retorna o prompt do sistema como output (útil para agentes rule-based
 * que não precisam de LLM — ex: roteadores, validadores, formatadores).
 */
export class NoneAdapter implements LLMAdapter {
  readonly provider = "none";

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const systemMsg = request.messages.find((m) => m.role === "system");
    const userMsg = request.messages.find((m) => m.role === "user");

    // Para agentes "none", simplesmente retorna o que foi enviado como contexto.
    // O executor pode sobrescrever este comportamento com lógica custom.
    const content = [
      systemMsg ? `[SYSTEM]: ${systemMsg.content}` : "",
      userMsg ? `[INPUT]: ${userMsg.content}` : "",
      "[OUTPUT]: No LLM configured. Implement your rule-based logic in the executor.",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      content,
      provider: "none",
      model: "none",
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
  }
}
