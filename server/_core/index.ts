import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { invokeLLMStream } from "./llm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Log-only safety net: an uncaught error inside a request handler should
// already turn into a clean tRPC error response (see routers/lessons.ts),
// but if something outside that path throws asynchronously, surface it in
// the Render logs instead of letting the process die silently and restart
// mid-request, which presents to the client as an HTML 502.
process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught exception:", err instanceof Error ? err.message : err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Server] Unhandled rejection:", reason instanceof Error ? reason.message : reason);
});

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Small, dependency-free security baseline for the beta.
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  // Basic in-memory rate limit for sensitive API surfaces.
  const requestBuckets = new Map<string, { started: number; count: number }>();
  app.use("/api", (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = requestBuckets.get(key);
    if (!bucket || now - bucket.started > 60_000) {
      requestBuckets.set(key, { started: now, count: 1 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > 180) return res.status(429).json({ error: "Too many requests. Please slow down and try again." });
    next();
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // AI Streaming endpoint
  app.post("/api/ai/stream", express.json({ limit: "50mb" }), async (req, res) => {
    try {
      const { messages, ...params } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "messages array required" });
      }
      
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      await invokeLLMStream({ messages, ...params }, (chunk) => {
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        res.write(data);
      });
      
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stream error";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    console.log("[Server] Setting up Vite...");
    await setupVite(app, server);
    console.log("[Server] Vite setup complete");
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");

  // Render (and most hosts) assign PORT and route platform traffic to
  // exactly that port — there is nothing else running in the container to
  // collide with it. Silently binding to a different port if the preferred
  // one "looks" busy would leave the app listening somewhere the platform
  // never forwards requests to, which looks like a total outage (every
  // route 502s, not just this one) with no error in the logs to explain
  // why. Only do the scan-for-a-free-port convenience in development,
  // where multiple local dev servers commonly compete for 3000.
  const port = process.env.NODE_ENV === "production"
    ? preferredPort
    : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  console.log(`[Server] Starting server on port ${port}...`);

  // Render's load balancer keeps idle keep-alive connections open longer
  // than Node's defaults (5s/60s), which can cause it to reuse a connection
  // right as Node is about to close it — surfacing as an intermittent 502
  // unrelated to any application error. Keeping our timeouts comfortably
  // above Render's documented keep-alive window avoids that race.
  server.keepAliveTimeout = 121_000;
  server.headersTimeout = 125_000;

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  server.on('error', (err) => {
    console.error('[Server] Error:', err);
  });

  server.on('listening', () => {
    console.log('[Server] Listening event fired');
    const address = server.address();
    console.log('[Server] Address:', address);
  });
}

startServer().catch(console.error);
