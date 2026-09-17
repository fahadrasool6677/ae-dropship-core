import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env
dotenv.config();

export interface AppConfig {
  appKey: string;
  appSecret: string;
  redirectUri: string;
  accessToken?: string;
  port: number;
}

export function getConfig(): AppConfig {
  return {
    appKey: (process.env.ALIEXPRESS_APP_KEY || "").trim(),
    appSecret: (process.env.ALIEXPRESS_APP_SECRET || "").trim(),
    redirectUri: (process.env.ALIEXPRESS_REDIRECT_URI || "http://localhost:3000/api/aliexpress/auth/callback").trim(),
    accessToken: process.env.ALIEXPRESS_ACCESS_TOKEN?.trim() || undefined,
    port: parseInt(process.env.PORT || "3000", 10),
  };
}

/**
 * Validates whether the required base credentials are present.
 * Throws a descriptive error if appKey or appSecret is missing.
 */
export function validateCredentials(): { appKey: string; appSecret: string; redirectUri: string } {
  const config = getConfig();

  if (!config.appKey || config.appKey === "your_app_key_here") {
    throw new Error(
      "Missing ALIEXPRESS_APP_KEY. Please set your AliExpress App Key in the .env file."
    );
  }

  if (!config.appSecret || config.appSecret === "your_app_secret_here") {
    throw new Error(
      "Missing ALIEXPRESS_APP_SECRET. Please set your AliExpress App Secret in the .env file."
    );
  }

  return {
    appKey: config.appKey,
    appSecret: config.appSecret,
    redirectUri: config.redirectUri,
  };
}
