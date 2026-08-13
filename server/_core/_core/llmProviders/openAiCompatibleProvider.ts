import { fetchWithBackoff } from "./httpRetry";
import { buildChatCompletionsPayload } from "./normalize";
import type { InvokeParams, InvokeResult, LLMProvider, ModelsResponse, StreamChunk, StreamCallback } from "./types";

export type OpenAICompatibleConfig = {
  id: string;
  /** Full URL to the chat completions endpoint, e.g. https://host/v1/chat/completions */
  chatCompletionsUrl: string;
  /** Full URL to the models list endpoint, e.g. https://host/v1/models */
  modelsUrl: string;
  apiKey: string;
  /** Human-readable name used in error messages, e.g. "NVIDIA NIM". */
  label: string;
  /** Env var name to mention in the missing-key error, e.g. "NVIDIA_NIM_API_KEY". */
  apiKeyEnvVar: string;
  /**
   * Model to send when the caller didn't specify one. Forge can pick a
   * default server-side (undefined is fine); NIM requires an explicit
   * model on every request.
   */
  defaultModel?: string;
};

/**
 * Any backend that implements the OpenAI /v1/chat/completions + /v1/models
 * contract can be wired up by constructing this class with its endpoint
 * URLs and API key — no per-provider request/response translation needed.
 * Used by both the Forge provider and the NVIDIA NIM provider.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: string;
  private readonly config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.id = config.id;
    this.config = config;
  }

  private assertApiKey() {
    if (!this.config.apiKey) {
      throw new Error(`${this.config.apiKeyEnvVar} is not configured`);
    }
  }

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    this.assertApiKey();

    const payload = buildChatCompletionsPayload(params, this.config.defaultModel);

    const response = await fetchWithBackoff(this.config.chatCompletionsUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${this.config.label} invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
      );
    }

    return (await response.json()) as InvokeResult;
  }

  async invokeStream(params: InvokeParams, onChunk: StreamCallback): Promise<void> {
    this.assertApiKey();

    const payload = buildChatCompletionsPayload(params, this.config.defaultModel);
    payload.stream = true;

    const response = await fetchWithBackoff(this.config.chatCompletionsUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${this.config.label} stream invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        
        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            onChunk(json as StreamChunk);
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  async listModels(): Promise<ModelsResponse> {
    this.assertApiKey();

    const response = await fetchWithBackoff(this.config.modelsUrl, {
      headers: { authorization: `Bearer ${this.config.apiKey}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `List ${this.config.label} models failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
      );
    }

    return (await response.json()) as ModelsResponse;
  }
}
