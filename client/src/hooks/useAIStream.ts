import { useState, useCallback, useRef } from "react";

export type StreamingMessage = {
  role: "user" | "assistant";
  content: string;
};

export type UseAIStreamOptions = {
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
  onChunk?: (chunk: string) => void;
};

export function useAIStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
      options: UseAIStreamOptions = {}
    ) => {
      const { onComplete, onError, onChunk } = options;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setStreamingContent("");

      try {
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Stream failed: ${response.status} ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;

            if (trimmed.startsWith("data: ")) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  fullContent += delta;
                  setStreamingContent(fullContent);
                  onChunk?.(delta);
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        onComplete?.(fullContent);
        return fullContent;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err);
        throw err;
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return {
    isStreaming,
    streamingContent,
    sendMessage,
    stopStreaming,
  };
}