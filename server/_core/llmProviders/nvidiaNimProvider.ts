import { ENV } from "../env";
import { OpenAICompatibleProvider } from "./openAiCompatibleProvider";

const DEFAULT_NVIDIA_NIM_API_URL = "https://integrate.api.nvidia.com/v1";

// A widely-available, instruction-tuned chat model on NVIDIA's hosted NIM
// catalog. Deployments that run their own NIM microservice (a different
// model per container) should override this with NVIDIA_NIM_MODEL.
const DEFAULT_NVIDIA_NIM_MODEL = "meta/llama-3.1-8b-instruct";

/**
 * NVIDIA NIM (Inference Microservices). Works against both the hosted
 * catalog at integrate.api.nvidia.com and a self-hosted NIM container
 * (point NVIDIA_NIM_API_URL at it) — both speak the same OpenAI-compatible
 * /v1/chat/completions and /v1/models contract.
 */
export function createNvidiaNimProvider() {
  const baseUrl = (ENV.nvidiaNimApiUrl && ENV.nvidiaNimApiUrl.trim().length > 0
    ? ENV.nvidiaNimApiUrl
    : DEFAULT_NVIDIA_NIM_API_URL
  ).replace(/\/$/, "");

  return new OpenAICompatibleProvider({
    id: "nvidia-nim",
    label: "NVIDIA NIM",
    apiKey: ENV.nvidiaNimApiKey,
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    chatCompletionsUrl: `${baseUrl}/chat/completions`,
    modelsUrl: `${baseUrl}/models`,
    // NIM requires an explicit model on every request.
    defaultModel:
      ENV.nvidiaNimModel && ENV.nvidiaNimModel.trim().length > 0
        ? ENV.nvidiaNimModel
        : DEFAULT_NVIDIA_NIM_MODEL,
  });
}
