import { afterEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./env";
import { __resetLLMProviderForTesting } from "./llmProviders/registry";
import { invokeLLM, invokeLLMStream } from "./llm";

const originalEnv = { ...ENV };
const originalFetch = global.fetch;

afterEach(() => {
  Object.assign(ENV, originalEnv);
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  __resetLLMProviderForTesting();
});

function okChatResponse() {
  return new Response(
    JSON.stringify({
      id: "1",
      created: 0,
      model: "x",
      choices: [{ index: 0, message: { role: "assistant", content: "hi from fallback" }, finish_reason: "stop" }],
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function unauthorizedResponse() {
  // 401 is not in the retryable status list, so the primary provider fails
  // on its first attempt instead of burning through retries/backoff.
  return new Response("unauthorized", { status: 401 });
}

describe("invokeLLM automatic provider failover", () => {
  it("falls over to forge when nvidia-nim fails and forge is configured", async () => {
    ENV.llmProvider = "nvidia-nim";
    ENV.nvidiaNimApiKey = "bad-nim-key";
    ENV.forgeApiKey = "good-forge-key";
    __resetLLMProviderForTesting();

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("integrate.api.nvidia.com")) return Promise.resolve(unauthorizedResponse());
      if (url.includes("forge.manus.im")) return Promise.resolve(okChatResponse());
      throw new Error(`unexpected url ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    expect(result.choices[0].message.content).toBe("hi from fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws the primary error when no fallback is configured", async () => {
    ENV.llmProvider = "nvidia-nim";
    ENV.nvidiaNimApiKey = "bad-nim-key";
    ENV.forgeApiKey = "";
    __resetLLMProviderForTesting();

    global.fetch = vi.fn().mockResolvedValue(unauthorizedResponse()) as unknown as typeof fetch;

    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/NVIDIA NIM/);
  });

  it("does not fall back once the primary provider has started streaming output", async () => {
    ENV.llmProvider = "nvidia-nim";
    ENV.nvidiaNimApiKey = "nim-key";
    ENV.forgeApiKey = "forge-key";
    __resetLLMProviderForTesting();

    const encoder = new TextEncoder();
    let pullCount = 0;
    const stream = new ReadableStream({
      async pull(controller) {
        pullCount += 1;
        if (pullCount === 1) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ id: "1", created: 0, model: "x", choices: [{ index: 0, delta: { content: "partial" }, finish_reason: null }] })}\n\n`
            )
          );
          return;
        }
        // Give the reader a turn to fully process the first chunk before
        // the connection drops, mirroring a real mid-stream network error.
        await new Promise((resolve) => setTimeout(resolve, 10));
        controller.error(new Error("connection dropped mid-stream"));
      },
    });

    global.fetch = vi.fn().mockResolvedValue(new Response(stream, { status: 200 })) as unknown as typeof fetch;

    const chunks: unknown[] = [];
    await expect(
      invokeLLMStream({ messages: [{ role: "user", content: "hi" }] }, (chunk) => chunks.push(chunk))
    ).rejects.toThrow();

    expect(chunks).toHaveLength(1);
  });
});
