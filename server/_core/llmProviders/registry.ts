import { ENV } from "../env";
import { createForgeProvider } from "./forgeProvider";
import { createNvidiaNimProvider } from "./nvidiaNimProvider";
import type { LLMProvider } from "./types";

export type LLMProviderId = "nvidia-nim" | "forge";

const FACTORIES: Record<LLMProviderId, () => LLMProvider> = {
  "nvidia-nim": createNvidiaNimProvider,
  forge: createForgeProvider,
};

function normalizeProviderId(raw: string): LLMProviderId {
  const value = raw.trim().toLowerCase();
  if (value === "forge" || value === "manus" || value === "manus-forge") return "forge";
  if (value === "nvidia-nim" || value === "nvidia" || value === "nim") return "nvidia-nim";
  console.warn(`[LLM] Unknown LLM_PROVIDER "${raw}", falling back to nvidia-nim`);
  return "nvidia-nim";
}

let cachedProvider: LLMProvider | null = null;
let cachedProviderId: LLMProviderId | null = null;
const cachedByFactory = new Map<LLMProviderId, LLMProvider>();

function buildProvider(providerId: LLMProviderId): LLMProvider {
  let provider = cachedByFactory.get(providerId);
  if (!provider) {
    provider = FACTORIES[providerId]();
    cachedByFactory.set(providerId, provider);
  }
  return provider;
}

/**
 * Returns the configured LLM provider, constructing it once and caching the
 * instance. Selection is via the LLM_PROVIDER env var (defaults to
 * "nvidia-nim"); set LLM_PROVIDER=forge to fall back to the original Manus
 * Forge backend.
 */
export function getLLMProvider(): LLMProvider {
  const providerId = normalizeProviderId(ENV.llmProvider || "nvidia-nim");

  if (!cachedProvider || cachedProviderId !== providerId) {
    cachedProvider = buildProvider(providerId);
    cachedProviderId = providerId;
  }

  return cachedProvider;
}

/** Whether a given provider has the credentials it needs to actually be called. */
function isProviderConfigured(providerId: LLMProviderId): boolean {
  if (providerId === "nvidia-nim") return Boolean(ENV.nvidiaNimApiKey);
  // Forge runs on the built-in Manus backend key, which is present by
  // default on this platform — that's what makes it a safe automatic
  // fallback rather than just another manual option.
  return Boolean(ENV.forgeApiKey);
}

/**
 * Returns the *other* provider, so a caller can retry against it when the
 * primary is down — but only if that provider is actually configured with
 * credentials. Returns null if there's nothing sensible to fall back to.
 */
export function getFallbackProvider(): LLMProvider | null {
  const primaryId = normalizeProviderId(ENV.llmProvider || "nvidia-nim");
  const fallbackId: LLMProviderId = primaryId === "nvidia-nim" ? "forge" : "nvidia-nim";

  if (!isProviderConfigured(fallbackId)) return null;

  return buildProvider(fallbackId);
}

/** Test-only: clears the cached provider so ENV changes take effect. */
export function __resetLLMProviderForTesting() {
  cachedProvider = null;
  cachedProviderId = null;
  cachedByFactory.clear();
}
