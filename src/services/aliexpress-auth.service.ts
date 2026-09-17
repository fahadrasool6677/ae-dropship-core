import { getConfig, validateCredentials } from "../config/env.js";
import { AliExpressHttpClient } from "../core/http-client.js";
import { TokenStore, StoredTokenData } from "../core/token-store.js";
import { AliExpressTokenResponse } from "../types/aliexpress.types.js";

export const AE_OAUTH_AUTHORIZE_URL = "https://api-sg.aliexpress.com/oauth/authorize";

export class AliExpressAuthService {
  private httpClient: AliExpressHttpClient;
  private tokenStore: TokenStore;

  constructor(httpClient?: AliExpressHttpClient, tokenStore?: TokenStore) {
    this.httpClient = httpClient || new AliExpressHttpClient();
    this.tokenStore = tokenStore || TokenStore.getInstance();
  }

  /**
   * Generates the OAuth 2.0 Authorization URL for the seller / dropshipper to authorize the app.
   *
   * @param state Optional CSRF state string
   * @returns Complete authorization URL
   */
  public getAuthorizationUrl(state = "dropshipping_auth"): string {
    const { appKey, redirectUri } = validateCredentials();

    const params = new URLSearchParams({
      response_type: "code",
      force_auth: "true",
      redirect_uri: redirectUri,
      client_id: appKey,
      state,
    });

    return `${AE_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code received from the OAuth callback for an Access Token and Refresh Token.
   *
   * Calls the AliExpress endpoint: POST https://api-sg.aliexpress.com/rest/auth/token/create
   *
   * @param code The authorization code from the redirect URI query parameter
   */
  public async exchangeCodeForToken(code: string): Promise<StoredTokenData> {
    if (!code || code.trim() === "") {
      throw new Error("Authorization code is required to obtain an access token.");
    }

    const { appKey, appSecret } = validateCredentials();

    console.log("[AliExpressAuthService] Exchanging authorization code for access token...");

    const response = await this.httpClient.post<AliExpressTokenResponse>({
      apiName: "/auth/token/create",
      appKey,
      appSecret,
      params: {
        code: code.trim(),
      },
    });

    if (!response.access_token) {
      throw new Error(
        `Failed to obtain access token from response: ${JSON.stringify(response)}`
      );
    }

    const stored = this.tokenStore.saveTokens(response);
    console.log(
      `[AliExpressAuthService] Successfully acquired and stored access token for user: ${stored.userNick || stored.userId || "authorized user"}`
    );

    return stored;
  }

  /**
   * Refreshes an expired or expiring access token using the stored refresh token.
   *
   * Calls the AliExpress endpoint: POST https://api-sg.aliexpress.com/rest/auth/token/refresh
   *
   * @param customRefreshToken Optional explicit refresh token to use instead of the stored one
   */
  public async refreshToken(customRefreshToken?: string): Promise<StoredTokenData> {
    const refreshTokenToUse = customRefreshToken || this.tokenStore.getRefreshToken();

    if (!refreshTokenToUse) {
      throw new Error(
        "No refresh token available to renew access token. Please re-authenticate via OAuth flow."
      );
    }

    const { appKey, appSecret } = validateCredentials();

    console.log("[AliExpressAuthService] Refreshing access token via /auth/token/refresh...");

    const response = await this.httpClient.post<AliExpressTokenResponse>({
      apiName: "/auth/token/refresh",
      appKey,
      appSecret,
      params: {
        refresh_token: refreshTokenToUse,
      },
    });

    if (!response.access_token) {
      throw new Error(
        `Failed to refresh access token from response: ${JSON.stringify(response)}`
      );
    }

    const stored = this.tokenStore.saveTokens(response);
    console.log("[AliExpressAuthService] Access token successfully refreshed.");

    return stored;
  }

  /**
   * Retrieves a valid, ready-to-use access token.
   * If the currently stored token is expired (or expiring in <5 min) and a refresh token exists,
   * it will automatically refresh the token transparently.
   */
  public async getValidAccessToken(): Promise<string> {
    // 1. Check if we need to refresh
    if (this.tokenStore.isTokenExpired() && this.tokenStore.getRefreshToken()) {
      console.log("[AliExpressAuthService] Stored token has expired. Refreshing automatically...");
      try {
        const refreshed = await this.refreshToken();
        return refreshed.accessToken;
      } catch (err) {
        console.warn(
          `[AliExpressAuthService] Auto-refresh failed: ${(err as Error).message}. Falling back to current token.`
        );
      }
    }

    // 2. Check current access token
    const token = this.tokenStore.getAccessToken();
    if (!token) {
      const authUrl = this.getAuthorizationUrl();
      throw new Error(
        `No AliExpress Access Token found.\n` +
        `Please complete the authorization flow by visiting:\n${authUrl}\n` +
        `Or configure ALIEXPRESS_ACCESS_TOKEN directly in your .env file.`
      );
    }

    return token;
  }

  /**
   * Returns current token status (whether token exists, expiration date, user nick).
   */
  public getTokenStatus() {
    return this.tokenStore.getTokenStatus();
  }
}
