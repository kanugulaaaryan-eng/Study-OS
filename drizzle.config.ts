import { defineConfig } from "drizzle-kit";
import "dotenv/config";

function parseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || "4000"),
    user: decodeURIComponent(u.username || ""),
    password: decodeURIComponent(u.password || ""),
    database: decodeURIComponent((u.pathname.split("/")[1] || "")),
    ssl: { rejectUnauthorized: false },
  };
}

const dbUrl = process.env.DATABASE_URL || "";

export default defineConfig({
  out: "./drizzle",
  schema: "./drizzle/schema.ts",
  dialect: "mysql",
  dbCredentials: dbUrl ? parseUrl(dbUrl) : { url: "" },
});
