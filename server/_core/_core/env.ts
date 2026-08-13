export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",

  // LLM provider selection. "nim" is accepted as a friendly alias.
  llmProvider: process.env.LLM_PROVIDER ?? "nvidia-nim",

  // Support both the canonical names and the short names used by the
  // StudyOS local setup instructions.
  nvidiaNimApiKey: process.env.NVIDIA_NIM_API_KEY ?? process.env.NIM_API_KEY ?? "",
  nvidiaNimApiUrl: process.env.NVIDIA_NIM_API_URL ?? process.env.NIM_BASE_URL ?? "",
  nvidiaNimModel: process.env.NVIDIA_NIM_MODEL ?? process.env.NIM_MODEL ?? "",
  nvidiaNimReasoningModel: process.env.NVIDIA_NIM_REASONING_MODEL ?? process.env.NIM_REASONING_MODEL ?? "",
};
