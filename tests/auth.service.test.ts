import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AliExpressAuthService } from "../src/services/aliexpress-auth.service.js";
import { TokenStore } from "../src/core/token-store.js";
import { AliExpressHttpClient } from "../src/core/http-client.js";
import fs from "fs";
import path from "path";

describe("AliExpressAuthService", () => {
  const testStoragePath = path.resolve(process.cwd(), ".token.test.json");
  let tokenStore: TokenStore;
  let mockHttpClient: AliExpressHttpClient;
  let authService: AliExpressAuthService;

  beforeEach(() => {
    // Setup test environment variables
    process.env.ALIEXPRESS_APP_KEY = "test_app_key_123";
    process.env.ALIEXPRESS_APP_SECRET = "test_app_secret_456";
    process.env.ALIEXPRESS_REDIRECT_URI = "http://localhost:3000/api/aliexpress/auth/callback";

    if (fs.existsSync(testStoragePath)) {
      fs.unlinkSync(testStoragePath);
    }

    tokenStore = new TokenStore(testStoragePath);
    mockHttpClient = new AliExpressHttpClient();
    authService = new AliExpressAuthService(mockHttpClient, tokenStore);
  });

  afterEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.unlinkSync(testStoragePath);
    }
    vi.restoreAllMocks();
  });

  it("should generate the correct AliExpress OAuth 2.0 authorization URL", () => {
    const url = authService.getAuthorizationUrl("test_state");
    expect(url).toContain("https://api-sg.aliexpress.com/oauth/authorize");
    expect(url).toContain("client_id=test_app_key_123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("force_auth=true");
    expect(url).toContain(encodeURIComponent("http://localhost:3000/api/aliexpress/auth/callback"));
    expect(url).toContain("state=test_state");
  });

  it("should exchange authorization code for tokens and store them", async () => {
    const mockTokenResponse = {
      access_token: "mock_access_token_111",
      refresh_token: "mock_refresh_token_222",
      expires_in: 2592000,
      expire_time: Date.now() + 2592000 * 1000,
      refresh_token_valid_time: Date.now() + 2592000 * 1000,
      user_nick: "dropship_tester",
      user_id: "user_98765",
    };

    vi.spyOn(mockHttpClient, "post").mockResolvedValueOnce(mockTokenResponse);

    const stored = await authService.exchangeCodeForToken("valid_auth_code_123");

    expect(stored.accessToken).toBe("mock_access_token_111");
    expect(stored.refreshToken).toBe("mock_refresh_token_222");
    expect(stored.userNick).toBe("dropship_tester");

    // Verify persisted token in TokenStore
    expect(tokenStore.getAccessToken()).toBe("mock_access_token_111");
    expect(tokenStore.getRefreshToken()).toBe("mock_refresh_token_222");
  });

  it("should refresh an expired token automatically via getValidAccessToken", async () => {
    // Save an expired token with a refresh token
    tokenStore.saveTokens({
      access_token: "expired_token_000",
      refresh_token: "valid_refresh_token_333",
      expires_in: -100, // already expired
      expire_time: Date.now() - 100_000,
      refresh_token_valid_time: Date.now() + 100_000_000,
    });

    const mockRefreshedResponse = {
      access_token: "newly_refreshed_token_444",
      refresh_token: "new_refresh_token_555",
      expires_in: 2592000,
      expire_time: Date.now() + 2592000 * 1000,
      refresh_token_valid_time: Date.now() + 2592000 * 1000,
    };

    vi.spyOn(mockHttpClient, "post").mockResolvedValueOnce(mockRefreshedResponse);

    const activeToken = await authService.getValidAccessToken();

    expect(activeToken).toBe("newly_refreshed_token_444");
    expect(tokenStore.getAccessToken()).toBe("newly_refreshed_token_444");
  });

  it("should throw a clear error when no access token exists", async () => {
    delete process.env.ALIEXPRESS_ACCESS_TOKEN;
    tokenStore.clear();

    await expect(authService.getValidAccessToken()).rejects.toThrow(
      /No AliExpress Access Token found/
    );
  });
});
