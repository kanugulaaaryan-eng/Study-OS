import type { Express } from "express";
import { ENV } from "./env";
import { readLocalStorage, readLocalStorageMeta } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/local-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) return res.status(400).send("Missing storage key");
    try {
      const buffer = await readLocalStorage(key);
      const meta = await readLocalStorageMeta(key);
      res.setHeader("Content-Type", meta.contentType || "application/octet-stream");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buffer);
    } catch {
      res.status(404).send("File not found");
    }
  });

  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) return res.status(400).send("Missing storage key");
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      return res.status(503).send("Remote storage is not configured. Local uploads are available in development.");
    }

    try {
      const forgeUrl = new URL("v1/storage/presign/get", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        return res.status(502).send("Storage backend error");
      }
      const { url } = await forgeResp.json() as { url: string };
      if (!url) return res.status(502).send("Empty signed URL from backend");
      res.set("Cache-Control", "private, max-age=3600");
      return res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      return res.status(502).send("Storage proxy error");
    }
  });
}
