import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { ENV } from "./_core/env";

/**
 * Storage works in two modes:
 * 1. Forge/S3 when BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY exist.
 * 2. Local disk fallback for zero-cost local/beta development.
 *
 * The local fallback is deliberately simple. It makes uploads usable without
 * a paid storage service. For a multi-instance production deployment, switch
 * back to S3-compatible storage.
 */
const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), "data", "uploads");
const LOCAL_PREFIX = "local:";

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) return null;
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\.(?=\/|$)/g, "");
}

function localPathForKey(key: string) {
  const safe = normalizeKey(key);
  const resolved = path.resolve(LOCAL_STORAGE_ROOT, safe);
  if (!resolved.startsWith(LOCAL_STORAGE_ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const forge = getForgeConfig();

  if (!forge) {
    const filePath = localPathForKey(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    await fs.writeFile(filePath, buffer);
    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify({ contentType }), "utf8");
    return { key: `${LOCAL_PREFIX}${key}`, url: `/local-storage/${encodeURIComponent(key).replace(/%2F/g, "/")}` };
  }

  const presignUrl = new URL("v1/storage/presign/put", forge.forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json() as { url: string };
  if (!s3Url) throw new Error("Storage backend returned an empty presign URL");

  const blob = new Blob([typeof data === "string" ? data : new Uint8Array(data)], { type: contentType });
  const uploadResp = await fetch(s3Url, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!uploadResp.ok) throw new Error(`Storage upload failed (${uploadResp.status})`);

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  if (key.startsWith(LOCAL_PREFIX)) {
    const localKey = key.slice(LOCAL_PREFIX.length);
    return { key, url: `/local-storage/${encodeURIComponent(localKey).replace(/%2F/g, "/")}` };
  }
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (key.startsWith(LOCAL_PREFIX)) {
    const localKey = key.slice(LOCAL_PREFIX.length);
    return `/local-storage/${encodeURIComponent(localKey).replace(/%2F/g, "/")}`;
  }

  const forge = getForgeConfig();
  if (!forge) throw new Error("Remote storage is not configured for this key");

  const getUrl = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json() as { url: string };
  return url;
}

export async function readLocalStorage(key: string) {
  const filePath = localPathForKey(key);
  return fs.readFile(filePath);
}

export async function readLocalStorageMeta(key: string): Promise<{ contentType?: string }> {
  try {
    const raw = await fs.readFile(`${localPathForKey(key)}.meta.json`, "utf8");
    return JSON.parse(raw) as { contentType?: string };
  } catch {
    return {};
  }
}
