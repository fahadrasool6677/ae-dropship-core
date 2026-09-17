import fs from "fs";
import path from "path";
import { AliExpressTokenResponse } from "../types/aliexpress.types.js";
import { getConfig } from "../config/env.js";

export interface StoredTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp in milliseconds
  refreshExpiresAt?: number; // Unix timestamp in milliseconds
  userId?: string;
  userNick?: string;
  updatedAt: string;
}

export class TokenStore {
  private static instance: TokenStore;
  private filePath: string;
  private cachedData: StoredTokenData | null = null;

  constructor(storagePath?: string) {
    this.filePath = storagePath || path.resolve(process.cwd(), ".token.json");
    this.loadFromDisk();
  }

  public static getInstance(): TokenStore {
    if (!TokenStore.instance) {
      TokenStore.instance = new TokenStore();
    }
    return TokenStore.instance;
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.cachedData = JSON.parse(raw);
      }
    } catch (err) {
      console.warn("Warning: Could not read token file from disk:", (err as Error).message);
      this.cachedData = null;
    }
  }

  /**
   * Retrieves the current access token.
   * Priority:
   * 1. Stored token in .token.json
   * 2. Config/environment variable (ALIEXPRESS_ACCESS_TOKEN)
   */
  public getAccessToken(): string | null {
    if (this.cachedData?.accessToken) {
      return this.cachedData.accessToken;
    }

    const envToken = getConfig().accessToken;
    if (envToken && envToken.trim() !== "") {
      return envToken.trim();
    }

    return null;
  }

  /**
   * Retrieves the current refresh token if available.
   */
  public getRefreshToken(): string | null {
    return this.cachedData?.refreshToken || null;
  }

  /**
   * Checks whether the current access token has expired (or is close to expiring).
   * @param bufferMs Safety buffer in milliseconds (default 5 minutes / 300,000ms)
   */
  public isTokenExpired(bufferMs = 300_000): boolean {
    if (!this.cachedData?.expiresAt) {
      // If we only have an env token without expiry timestamp, assume valid until an API error occurs
      return false;
    }

    return Date.now() + bufferMs >= this.cachedData.expiresAt;
  }

  /**
   * Saves the token response received from AliExpress OAuth flow or refresh.
   */
  public saveTokens(response: AliExpressTokenResponse): StoredTokenData {
    // Determine expiration time: expire_time or Date.now() + expires_in * 1000
    let expiresAt: number | undefined = undefined;
    if (response.expire_time) {
      expiresAt = response.expire_time > 1000000000000 
        ? response.expire_time 
        : response.expire_time * 1000;
    } else if (response.expires_in) {
      expiresAt = Date.now() + response.expires_in * 1000;
    }

    let refreshExpiresAt: number | undefined = undefined;
    if (response.refresh_token_valid_time) {
      refreshExpiresAt = response.refresh_token_valid_time > 1000000000000
        ? response.refresh_token_valid_time
        : response.refresh_token_valid_time * 1000;
    } else if (response.refresh_expires_in) {
      refreshExpiresAt = Date.now() + response.refresh_expires_in * 1000;
    }

    const data: StoredTokenData = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token || this.cachedData?.refreshToken,
      expiresAt,
      refreshExpiresAt,
      userId: response.user_id,
      userNick: response.user_nick,
      updatedAt: new Date().toISOString(),
    };

    this.cachedData = data;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.warn("Warning: Could not persist token to disk:", (err as Error).message);
    }

    return data;
  }

  /**
   * Returns current token metadata without exposing sensitive full keys in logs.
   */
  public getTokenStatus(): {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiresAt?: string;
    isExpired: boolean;
    userNick?: string;
  } {
    const token = this.getAccessToken();
    return {
      hasAccessToken: Boolean(token),
      hasRefreshToken: Boolean(this.getRefreshToken()),
      expiresAt: this.cachedData?.expiresAt
        ? new Date(this.cachedData.expiresAt).toISOString()
        : undefined,
      isExpired: this.isTokenExpired(),
      userNick: this.cachedData?.userNick,
    };
  }

  /**
   * Clears stored tokens.
   */
  public clear(): void {
    this.cachedData = null;
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (err) {
      console.warn("Warning: Could not remove token file:", (err as Error).message);
    }
  }
}
