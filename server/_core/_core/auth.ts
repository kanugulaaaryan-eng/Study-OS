import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";
const DEV_JWT_SECRET = "studyos-local-dev-secret-change-before-production";

function jwtSecret() {
  return new TextEncoder().encode(ENV.cookieSecret || DEV_JWT_SECRET);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validatePassword(password: string) {
  if (password.length < 8) return "Use at least 8 characters for your password.";
  if (password.length > 128) return "That password is too long.";
  return null;
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

async function createSessionToken(userId: number, rememberMe = true) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? "30d" : "12h")
    .sign(jwtSecret());
}

async function getSessionUserId(req: Request) {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, jwtSecret());
    const userId = verified.payload.userId;
    return typeof userId === "number" ? userId : null;
  } catch {
    return null;
  }
}

async function setSessionCookie(req: Request, res: Response, userId: number, rememberMe = true) {
  const token = await createSessionToken(userId, rememberMe);
  const options = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, token, { ...options, maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : undefined });
}

function clearSessionCookie(req: Request, res: Response) {
  const options = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...options, maxAge: -1 });
}

function generateGoogleOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGoogleCodeForTokens(code: string) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    client_secret: GOOGLE_CLIENT_SECRET!,
    code,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) throw new Error("Failed to exchange Google code");
  return response.json() as Promise<{ access_token: string }>;
}

async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Failed to read Google profile");
  return response.json() as Promise<{ id: string; name?: string; email?: string }>;
}

function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

function isValidNimApiKey(apiKey: string) {
  return typeof apiKey === "string" && apiKey.startsWith("nvapi-") && apiKey.length > 20;
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
      const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!name) return res.status(400).json({ error: "Tell us your name first." });
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ error: passwordError });
      if (await db.getUserByEmail(email)) return res.status(409).json({ error: "An account already exists with that email." });

      const user = await db.createUser({
        name,
        email,
        passwordHash: hashPassword(password),
        apiKeyHash: null,
        loginMethod: "email",
      });
      await setSessionCookie(req, res, user.id, true);
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      console.error("[Auth] Signup failed", error);
      res.status(500).json({ error: "Couldn't create your account right now." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const rememberMe = req.body?.rememberMe !== false;
      const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey : "";

      // Backward-compatible local developer login. It is never shown in the UI.
      if (apiKey) {
        const keyToUse = apiKey || ENV.nvidiaNimApiKey;
        if (!isValidNimApiKey(keyToUse) || (ENV.nvidiaNimApiKey && keyToUse !== ENV.nvidiaNimApiKey)) {
          return res.status(401).json({ error: "That NVIDIA key isn't valid." });
        }
        const hashedKey = hashApiKey(keyToUse);
        let user = await db.getUserByApiKey(hashedKey);
        if (!user) user = await db.createUser({ name: "Student", email: null, apiKeyHash: hashedKey, loginMethod: "nim-api" });
        await setSessionCookie(req, res, user.id);
        return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
      }

      if (!email || !password) return res.status(400).json({ error: "Enter your email and password." });
      const user = await db.getUserByEmail(email);
      if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Email or password doesn't match." });
      }
      await setSessionCookie(req, res, user.id, rememberMe);
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Couldn't sign you in right now." });
    }
  });

  app.get("/api/auth/google", (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({ error: "Google login isn't configured on this deployment yet." });
    }
    const state = randomBytes(16).toString("hex");
    res.cookie("oauth_state", state, { httpOnly: true, maxAge: 600000, sameSite: "lax", secure: req.protocol === "https" });
    res.redirect(generateGoogleOAuthUrl(state));
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return res.redirect("/login?error=google_not_configured");
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!code || !state || state !== parseCookieHeader(req.headers.cookie ?? "").oauth_state) return res.redirect("/login?error=oauth_invalid_state");
      res.clearCookie("oauth_state");
      const tokens = await exchangeGoogleCodeForTokens(code);
      const profile = await getGoogleUserInfo(tokens.access_token);
      if (!profile.email) return res.redirect("/login?error=google_email_missing");

      const openId = `google-${createHash("sha256").update(profile.id).digest("hex").slice(0, 24)}`;
      let user = await db.getUserByOpenId(openId);
      if (!user) {
        user = await db.createUser({
          openId,
          name: profile.name || profile.email.split("@")[0],
          email: normalizeEmail(profile.email),
          apiKeyHash: null,
          passwordHash: null,
          loginMethod: "google",
        });
      } else if (!user.name && profile.name) {
        user = (await db.updateUserName(user.id, profile.name)) ?? user;
      }
      await setSessionCookie(req, res, user.id);
      res.redirect("/dashboard");
    } catch (error) {
      console.error("[Auth] Google OAuth failed", error);
      res.redirect("/login?error=oauth_failed");
    }
  });

  app.patch("/api/auth/profile", async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
    if (!name) return res.status(400).json({ error: "Name is required" });
    const updated = await db.updateUserName(user.id, name);
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user: { id: updated.id, name: updated.name, email: updated.email } });
  });

  app.post("/api/auth/logout", (req, res) => {
    clearSessionCookie(req, res);
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  });
}

export async function getSessionUser(req: Request) {
  const userId = await getSessionUserId(req);
  if (!userId) return null;
  return db.getUserById(userId);
}

export async function requireAuth(req: Request, res: Response, next: Function) {
  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  (req as any).userId = user.id;
  next();
}

export { createSessionToken, clearSessionCookie };
