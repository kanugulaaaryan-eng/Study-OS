import { ENV } from "../env";
import { OpenAICompatibleProvider } from "./openAiCompatibleProvider";

const DEFAULT_FORGE_API_URL = "https://forge.manus.im";

/**
 * The original backend this app shipped with. Kept available and selectable
 * via LLM_PROVIDER=forge so the provider is configurable rather than a
 * one-way rewrite — see server/_core/llm.ts for how the active provider is
 * chosen.
 */
export function createForgeProvider() {
  const baseUrl = (ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? ENV.forgeApiUrl
    : DEFAULT_FORGE_API_URL
  ).replace(/\/$/, "");

  return new OpenAICompatibleProvider({
    id: "forge",
    label: "Manus Forge",
    apiKey: ENV.forgeApiKey,
    // Preserves the original error text ("OPENAI_API_KEY is not
    // configured") that this backend has always thrown when unset.
    apiKeyEnvVar: "OPENAI_API_KEY",
    chatCompletionsUrl: `${baseUrl}/v1/chat/completions`,
    modelsUrl: `${baseUrl}/v1/models`,
    // Forge picks a default model server-side when none is given.
    defaultModel: undefined,
  });
}
