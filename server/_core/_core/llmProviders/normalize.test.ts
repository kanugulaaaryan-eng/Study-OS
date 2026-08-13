import { describe, expect, it } from "vitest";
import { buildChatCompletionsPayload, normalizeMessage, normalizeToolChoice } from "./normalize";
import type { Message, Tool } from "./types";

describe("normalizeMessage", () => {
  it("collapses a single text content part to a plain string", () => {
    const message: Message = { role: "user", content: "Hello" };
    expect(normalizeMessage(message)).toEqual({ role: "user", name: undefined, content: "Hello" });
  });

  it("keeps multi-part content (text + image) as an array", () => {
    const message: Message = {
      role: "user",
      content: ["Look at this", { type: "image_url", image_url: { url: "https://x/y.png" } }],
    };
    const normalized = normalizeMessage(message);
    expect(Array.isArray(normalized.content)).toBe(true);
    expect((normalized.content as unknown[]).length).toBe(2);
  });

  it("stringifies tool/function role content", () => {
    const message: Message = {
      role: "tool",
      tool_call_id: "call_1",
      content: { type: "text", text: "42" },
    };
    const normalized = normalizeMessage(message);
    expect(normalized.content).toBe(JSON.stringify({ type: "text", text: "42" }));
  });
});

describe("normalizeToolChoice", () => {
  const tools: Tool[] = [{ type: "function", function: { name: "search" } }];

  it("passes through 'auto' and 'none' unchanged", () => {
    expect(normalizeToolChoice("auto", tools)).toBe("auto");
    expect(normalizeToolChoice("none", tools)).toBe("none");
  });

  it("resolves 'required' to the single configured tool", () => {
    expect(normalizeToolChoice("required", tools)).toEqual({
      type: "function",
      function: { name: "search" },
    });
  });

  it("throws if 'required' is used with zero or multiple tools", () => {
    expect(() => normalizeToolChoice("required", [])).toThrow();
    expect(() =>
      normalizeToolChoice("required", [...tools, { type: "function", function: { name: "x" } }])
    ).toThrow();
  });

  it("resolves a by-name tool choice", () => {
    expect(normalizeToolChoice({ name: "search" }, tools)).toEqual({
      type: "function",
      function: { name: "search" },
    });
  });
});

describe("buildChatCompletionsPayload", () => {
  const baseParams = { messages: [{ role: "user" as const, content: "hi" }] };

  it("omits model when none is given and no default is configured", () => {
    const payload = buildChatCompletionsPayload(baseParams, undefined);
    expect(payload.model).toBeUndefined();
  });

  it("injects the default model when the caller didn't specify one", () => {
    const payload = buildChatCompletionsPayload(baseParams, "meta/llama-3.1-8b-instruct");
    expect(payload.model).toBe("meta/llama-3.1-8b-instruct");
  });

  it("prefers an explicitly requested model over the default", () => {
    const payload = buildChatCompletionsPayload({ ...baseParams, model: "custom-model" }, "default-model");
    expect(payload.model).toBe("custom-model");
  });

  it("maps max_tokens/maxTokens to max_tokens", () => {
    expect(buildChatCompletionsPayload({ ...baseParams, maxTokens: 100 }).max_tokens).toBe(100);
    expect(buildChatCompletionsPayload({ ...baseParams, max_tokens: 200 }).max_tokens).toBe(200);
  });
});
