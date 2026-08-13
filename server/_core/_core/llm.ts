// Public LLM entry point used throughout the server (`import { invokeLLM }
// from "./_core/llm"` / `"../_core/llm"`). This file is intentionally a
// thin facade: it re-exports the provider-agnostic types and delegates the
// actual HTTP work to whichever provider is configured (see
// server/_core/llmProviders/registry.ts). No caller needs to change.
//
// Backend is selected via the LLM_PROVIDER env var:
//   - "nvidia-nim" (default) — NVIDIA NIM, see llmProviders/nvidiaNimProvider.ts
//   - "forge"                — the original Manus Forge backend, preserved
//                              for configurability, see llmProviders/forgeProvider.ts
//
// Both are OpenAI-chat-completions-compatible, so request/response shaping
// (message normalization, retries, JSON schema handling) lives once in
// llmProviders/normalize.ts + llmProviders/openAiCompatibleProvider.ts
// rather than being duplicated per backend.

import { getLLMProvider, getFallbackProvider } from "./llmProviders/registry";

export type {
  Role,
  TextContent,
  ImageContent,
  FileContent,
  MessageContent,
  Message,
  Tool,
  ToolChoicePrimitive,
  ToolChoiceByName,
  ToolChoiceExplicit,
  ToolChoice,
  InvokeParams,
  ToolCall,
  InvokeResult,
  JsonSchema,
  OutputSchema,
  ResponseFormat,
  ModelInfo,
  ModelsResponse,
  StreamChunk,
  StreamCallback,
} from "./llmProviders/types";

import type { InvokeParams, InvokeResult, ModelsResponse, StreamCallback } from "./llmProviders/types";

// invokeLLM/invokeLLMStream retry against the *same* provider internally
// (see llmProviders/httpRetry.ts) for transient errors. This layer handles
// the case where the primary provider is down entirely — missing/invalid
// credentials, or every retry against it was exhausted — by failing over
// to whichever other provider is actually configured, once, per call. That
// keeps a single flaky/misconfigured provider from turning into a hard
// outage for the whole app.

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const primary = getLLMProvider();
  try {
    return await primary.invoke(params);
  } catch (primaryError) {
    const fallback = getFallbackProvider();
    if (!fallback) throw primaryError;

    console.warn(
      `[LLM] Primary provider "${primary.id}" failed, retrying once against fallback "${fallback.id}":`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );
    return await fallback.invoke(params);
  }
}

export async function invokeLLMStream(params: InvokeParams, onChunk: StreamCallback): Promise<void> {
  const primary = getLLMProvider();
  let streamStarted = false;
  const trackingOnChunk: StreamCallback = (chunk) => {
    streamStarted = true;
    onChunk(chunk);
  };

  try {
    return await primary.invokeStream(params, trackingOnChunk);
  } catch (primaryError) {
    // Once tokens have already reached the client, switching providers
    // mid-stream would duplicate or corrupt the response, so only fail
    // over if the primary never got as far as producing output.
    if (streamStarted) throw primaryError;

    const fallback = getFallbackProvider();
    if (!fallback) throw primaryError;

    console.warn(
      `[LLM] Primary provider "${primary.id}" failed before streaming any output, retrying once against fallback "${fallback.id}":`,
      primaryError instanceof Error ? primaryError.message : primaryError
    );
    return await fallback.invokeStream(params, onChunk);
  }
}

export async function listLLMModels(): Promise<ModelsResponse> {
  return getLLMProvider().listModels();
}
