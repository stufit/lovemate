import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
for (const path of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
]) {
  if (existsSync(path)) {
    dotenv({ path, quiet: true });
    break;
  }
}
export function settings() {
  const production = process.env.NODE_ENV === "production";
  const provider = process.env.PAYMENT_PROVIDER ?? "mock";
  if (production && provider === "mock")
    throw new Error("Production cannot run with mock payments.");
  if (provider !== "mock")
    throw new Error("A real payment provider has not been implemented.");
  const pepper = process.env.SESSION_TOKEN_HASH_PEPPER;
  if (!pepper || pepper.length < 32 || pepper.startsWith("REPLACE_"))
    throw new Error(
      "Set SESSION_TOKEN_HASH_PEPPER to a random value of at least 32 characters.",
    );
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  const webUrl = process.env.WEB_BASE_URL ?? "http://127.0.0.1:3200";
  const secure = process.env.COOKIE_SECURE === "true";
  if (production && (!secure || !webUrl.startsWith("https://")))
    throw new Error("Production requires HTTPS and secure cookies.");
  return {
    production,
    provider,
    pepper,
    databaseUrl: url,
    webUrl,
    secure,
    port: Number(process.env.PORT ?? 4000),
  };
}
