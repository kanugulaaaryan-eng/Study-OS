import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "../env";
import { getLLMProvider, getFallbackProvider, __resetLLMProviderForTesting } from "./registry";

const originalEnv = { ...ENV };

afterEach(() => {
  Object.assign(ENV, originalEnv);
  __resetLLMProviderForTesting();
});

describe("getLLMProvider", () => {
  it("defaults to nvidia-nim when LLM_PROVIDER is unset", () => {
    ENV.llmProvider = "";
    __resetLLMProviderForTesting();
    expect(getLLMProvider().id).toBe("nvidia-nim");
  });

  it("selects forge when LLM_PROVIDER=forge", () => {
    ENV.llmProvider = "forge";
    __resetLLMProviderForTesting();
    expect(getLLMProvider().id).toBe("forge");
  });

  it("selects nvidia-nim when LLM_PROVIDER=nvidia-nim", () => {
    ENV.llmProvider = "nvidia-nim";
    __resetLLMProviderForTesting();
    expect(getLLMProvider().id).toBe("nvidia-nim");
  });

  it("falls back to nvidia-nim for an unrecognized value", () => {
    ENV.llmProvider = "some-other-backend";
    __resetLLMProviderForTesting();
    expect(getLLMProvider().id).toBe("nvidia-nim");
  });

  it("caches the provider instance across calls until the id changes", () => {
    ENV.llmProvider = "nvidia-nim";
    __resetLLMProviderForTesting();
    const first = getLLMProvider();
    const second = getLLMProvider();
    expect(first).toBe(second);

    ENV.llmProvider = "forge";
    __resetLLMProviderForTesting();
    const third = getLLMProvider();
    expect(third).not.toBe(first);
    expect(third.id).toBe("forge");
  });
});

describe("getFallbackProvider", () => {
  it("returns forge as the fallback when nvidia-nim is primary and forge has a key", () => {
    ENV.llmProvider = "nvidia-nim";
    ENV.forgeApiKey = "test-forge-key";
    __resetLLMProviderForTesting();
    expect(getFallbackProvider()?.id).toBe("forge");
  });

  it("returns nvidia-nim as the fallback when forge is primary and nvidia-nim has a key", () => {
    ENV.llmProvider = "forge";
    ENV.nvidiaNimApiKey = "test-nim-key";
    __resetLLMProviderForTesting();
    expect(getFallbackProvider()?.id).toBe("nvidia-nim");
  });

  it("returns null when the other provider has no credentials configured", () => {
    ENV.llmProvider = "nvidia-nim";
    ENV.forgeApiKey = "";
    __resetLLMProviderForTesting();
    expect(getFallbackProvider()).toBeNull();
  });
});
