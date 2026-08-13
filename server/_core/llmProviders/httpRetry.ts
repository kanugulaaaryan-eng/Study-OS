// Generic retry-with-backoff for HTTP calls. Provider-agnostic — used by
// every LLM provider that talks to an HTTP API (which is all of them).
//
// Timeouts are configurable via env so slow networks / reasoning models
// (e.g. openai/gpt-oss-120b on NVIDIA NIM) don't abort mid-generation.

const RETRY_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 350;
const RETRY_MAX_DELAY_MS = 3_000;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Default overall request timeout (abort). Higher than the original 45s
// because reasoning models are slow to answer long structured generations.
const defaultTimeoutMs = (() => {
  const v = Number(process.env.LLM_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 120_000;
})();

const defaultConnectTimeoutMs = (() => {
  const v = Number(process.env.LLM_CONNECT_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 30_000;
})();

const defaultMaxRetries = (() => {
  const v = Number(process.env.LLM_MAX_RETRIES);
  return Number.isFinite(v) && v >= 0 ? v : RETRY_MAX_RETRIES;
})();

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff. The cap/2 floor guarantees a minimum
// delay so a misbehaving caller loop slows down instead of hammering the
// upstream while it keeps returning errors.
const computeBackoffDelay = (attempt: number, retryAfterMs?: number): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

// undici's default TCP connect timeout is 10s, which is too aggressive on
// slower networks and causes UND_ERR_CONNECT_TIMEOUT. We use AbortController
// for overall timeout and rely on the platform's fetch for connection handling.

// Retries non-2xx responses and network errors with exponential backoff, then
// returns the final Response so callers keep their existing error handling.
export const fetchWithBackoff = async (url: string, init: FetchInit, options?: { timeoutMs?: number; maxRetries?: number; connectTimeoutMs?: number }): Promise<Response> => {
  let lastError: unknown;

  const maxRetries = options?.maxRetries ?? defaultMaxRetries;
  const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs;
  // connectTimeoutMs is accepted for API compatibility but handled by platform fetch

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      const retryableStatus = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
      if (response.ok || !retryableStatus || attempt === maxRetries) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${maxRetries} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) throw error;
      console.warn(`LLM request retry ${attempt + 1}/${maxRetries} after network error`);
      await sleep(computeBackoffDelay(attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("LLM request failed after exhausting retries");
};

export const __testing = { computeBackoffDelay, parseRetryAfter };