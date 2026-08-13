import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "./openAiCompatibleProvider";

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

describe("OpenAICompatibleProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws a clear error if the API key is missing", async () => {
    const provider = new OpenAICompatibleProvider({
      id: "test",
      label: "Test Provider",
      apiKey: "",
      apiKeyEnvVar: "TEST_API_KEY",
      chatCompletionsUrl: "https://example.test/v1/chat/completions",
      modelsUrl: "https://example.test/v1/models",
    });

    await expect(provider.invoke({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      "TEST_API_KEY is not configured"
    );
  });

  it("POSTs the normalized payload with a bearer token and returns the parsed result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "cmpl-1",
        created: 0,
        model: "meta/llama-3.1-8b-instruct",
        choices: [{ index: 0, message: { role: "assistant", content: "hello!" }, finish_reason: "stop" }],
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenAICompatibleProvider({
      id: "nvidia-nim",
      label: "NVIDIA NIM",
      apiKey: "test-key",
      apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
      chatCompletionsUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
      modelsUrl: "https://integrate.api.nvidia.com/v1/models",
      defaultModel: "meta/llama-3.1-8b-instruct",
    });

    const result = await provider.invoke({ messages: [{ role: "user", content: "hi" }] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("meta/llama-3.1-8b-instruct");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(result.choices[0].message.content).toBe("hello!");
  });

  it("retries on a 500 and eventually succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, { status: 500 }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "cmpl-2",
          created: 0,
          model: "m",
          choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(global, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout);

    const provider = new OpenAICompatibleProvider({
      id: "test",
      label: "Test",
      apiKey: "k",
      apiKeyEnvVar: "K",
      chatCompletionsUrl: "https://example.test/v1/chat/completions",
      modelsUrl: "https://example.test/v1/models",
    });

    const result = await provider.invoke({ messages: [{ role: "user", content: "hi" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.choices[0].message.content).toBe("ok");
  });

  it("throws with status + body text when the backend returns a non-retryable-forever error", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response("bad request", { status: 400, statusText: "Bad Request" }))
      );
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(global, "setTimeout").mockImplementation(((fn: () => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout);

    const provider = new OpenAICompatibleProvider({
      id: "test",
      label: "Test Provider",
      apiKey: "k",
      apiKeyEnvVar: "K",
      chatCompletionsUrl: "https://example.test/v1/chat/completions",
      modelsUrl: "https://example.test/v1/models",
    });

    // Non-2xx keeps retrying up to the internal cap, but eventually surfaces
    // a descriptive error including the provider label and status.
    await expect(provider.invoke({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /Test Provider invoke failed: 400/
    );
  });

  it("listModels hits the models endpoint and returns the parsed list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ object: "list", data: [{ id: "m1", object: "model", created: 0, owned_by: "nvidia" }] })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenAICompatibleProvider({
      id: "nvidia-nim",
      label: "NVIDIA NIM",
      apiKey: "k",
      apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
      chatCompletionsUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
      modelsUrl: "https://integrate.api.nvidia.com/v1/models",
    });

    const result = await provider.listModels();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://integrate.api.nvidia.com/v1/models",
      expect.objectContaining({ headers: { authorization: "Bearer k" } })
    );
    expect(result.data[0].id).toBe("m1");
  });
});
