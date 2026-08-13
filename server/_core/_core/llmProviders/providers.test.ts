import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "../env";
import { createForgeProvider } from "./forgeProvider";
import { createNvidiaNimProvider } from "./nvidiaNimProvider";

const originalEnv = { ...ENV };
const originalFetch = global.fetch;

afterEach(() => {
  Object.assign(ENV, originalEnv);
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("createForgeProvider", () => {
  it("defaults to the forge.manus.im endpoint and omits model when unset", async () => {
    ENV.forgeApiUrl = "";
    ENV.forgeApiKey = "forge-key";
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      expect(url).toBe("https://forge.manus.im/v1/chat/completions");
      return Promise.resolve(
        jsonResponse({ id: "1", created: 0, model: "x", choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }] })
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = createForgeProvider();
    await provider.invoke({ messages: [{ role: "user", content: "hi" }] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBeUndefined();
  });

  it("reports the legacy OPENAI_API_KEY error when no key is configured", async () => {
    ENV.forgeApiKey = "";
    const provider = createForgeProvider();
    await expect(provider.invoke({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      "OPENAI_API_KEY is not configured"
    );
  });
});

describe("createNvidiaNimProvider", () => {
  it("defaults to integrate.api.nvidia.com and injects the default model", async () => {
    ENV.nvidiaNimApiUrl = "";
    ENV.nvidiaNimModel = "";
    ENV.nvidiaNimApiKey = "nim-key";
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
      return Promise.resolve(
        jsonResponse({ id: "1", created: 0, model: "x", choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }] })
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = createNvidiaNimProvider();
    await provider.invoke({ messages: [{ role: "user", content: "hi" }] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("meta/llama-3.1-8b-instruct");
  });

  it("respects NVIDIA_NIM_API_URL and NVIDIA_NIM_MODEL overrides", async () => {
    ENV.nvidiaNimApiUrl = "https://my-nim-host:8000/v1";
    ENV.nvidiaNimModel = "meta/llama-3.1-8b-instruct";
    ENV.nvidiaNimApiKey = "nim-key";
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      expect(url).toBe("https://my-nim-host:8000/v1/chat/completions");
      return Promise.resolve(
        jsonResponse({ id: "1", created: 0, model: "x", choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }] })
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = createNvidiaNimProvider();
    await provider.invoke({ messages: [{ role: "user", content: "hi" }] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("meta/llama-3.1-8b-instruct");
  });

  it("reports the NVIDIA_NIM_API_KEY error when no key is configured", async () => {
    ENV.nvidiaNimApiKey = "";
    const provider = createNvidiaNimProvider();
    await expect(provider.invoke({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      "NVIDIA_NIM_API_KEY is not configured"
    );
  });
});
