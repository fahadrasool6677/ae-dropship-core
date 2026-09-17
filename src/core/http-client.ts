import { generateAliExpressSignature } from "./signer.js";
import { AliExpressErrorResponse } from "../types/aliexpress.types.js";

export const AE_REST_API_URL = "https://api-sg.aliexpress.com/rest";
export const AE_SYNC_API_URL = "https://api-sg.aliexpress.com/sync";

export interface RequestOptions {
  apiName: string; // e.g. "/auth/token/create" or "aliexpress.ds.product.get"
  appKey: string;
  appSecret: string;
  session?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
}

export class AliExpressApiError extends Error {
  public code?: string | number;
  public subCode?: string;
  public subMsg?: string;
  public requestId?: string;
  public rawError?: AliExpressErrorResponse;

  constructor(message: string, error?: AliExpressErrorResponse) {
    super(message);
    this.name = "AliExpressApiError";
    if (error) {
      this.code = error.code;
      this.subCode = error.sub_code;
      this.subMsg = error.sub_msg;
      this.requestId = error.request_id;
      this.rawError = error;
    }
  }
}

/**
 * Redacts secrets from parameter logs to prevent accidental exposure.
 */
function sanitizeParamsForLog(
  params: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(params)) {
    if (
      ["app_secret", "session", "access_token", "refresh_token", "code", "sign"].includes(
        key.toLowerCase()
      ) &&
      typeof val === "string"
    ) {
      sanitized[key] = val.length > 8 ? `${val.slice(0, 4)}...${val.slice(-4)}` : "***";
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export class AliExpressHttpClient {
  /**
   * Executes an authenticated request to the AliExpress Open Platform.
   */
  public async post<TResponse>(options: RequestOptions): Promise<TResponse> {
    const {
      apiName,
      appKey,
      appSecret,
      session,
      params = {},
      timeoutMs = 15000,
    } = options;

    const isRestApi = apiName.startsWith("/");
    const timestamp = Date.now();

    // Prepare full parameters
    const allParams: Record<string, string | number | boolean | null | undefined> = {
      ...params,
      app_key: appKey,
      timestamp,
      sign_method: "sha256",
    };

    if (session) {
      allParams.session = session;
    }

    if (!isRestApi) {
      allParams.method = apiName;
      allParams.format = "json";
      allParams.v = "2.0";
      allParams.simplify = true;
    }

    // Generate HMAC-SHA256 signature
    const signature = generateAliExpressSignature({
      appSecret,
      apiName,
      params: allParams,
    });

    allParams.sign = signature;

    // Construct URL with query parameters
    const baseUrl = isRestApi ? `${AE_REST_API_URL}${apiName}` : AE_SYNC_API_URL;

    // Assemble query string with properly encoded values
    const queryEntries = Object.entries(allParams).filter(
      ([_, val]) => val !== undefined && val !== null
    );

    // Sort entries alphabetically for predictability
    queryEntries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    const queryString = queryEntries
      .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
      .join("&");

    const fullUrl = `${baseUrl}?${queryString}`;

    // Debug logging (with sanitized params)
    const sanitizedLog = sanitizeParamsForLog(allParams);
    if (process.env.DEBUG === "true" || process.env.NODE_ENV === "development") {
      console.log(`[AliExpressClient] Request: POST ${baseUrl} [${apiName}]`, sanitizedLog);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          "User-Agent": "AliExpress-Dropshipping-Client/1.0",
        },
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeout);
      if ((err as Error).name === "AbortError") {
        throw new AliExpressApiError(
          `Request timeout after ${timeoutMs}ms calling AliExpress API [${apiName}]`
        );
      }
      throw new AliExpressApiError(
        `Network error communicating with AliExpress API: ${(err as Error).message}`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const statusText = response.statusText;
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch {
        // ignore
      }
      throw new AliExpressApiError(
        `AliExpress HTTP error ${response.status} (${statusText}): ${errorBody}`
      );
    }

    let json: any;
    try {
      json = await response.json();
    } catch (err) {
      throw new AliExpressApiError(
        `Failed to parse JSON response from AliExpress: ${(err as Error).message}`
      );
    }

    // Check for standard AliExpress error response wrapper
    if (json?.error_response) {
      const err = json.error_response as AliExpressErrorResponse;
      const errorMsg =
        err.sub_msg || err.msg || `AliExpress Error code: ${err.code || err.sub_code || "UNKNOWN"}`;
      throw new AliExpressApiError(
        `AliExpress API error: ${errorMsg} (sub_code: ${err.sub_code || "none"}, request_id: ${err.request_id || "none"})`,
        err
      );
    }

    return json as TResponse;
  }
}
