import crypto from "crypto";

export interface SignOptions {
  appSecret: string;
  apiName?: string;
  params: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Generates an HMAC-SHA256 signature for AliExpress Open Platform requests.
 *
 * Implements the official AliExpress IOP and TOP signing standard:
 * 1. Filters out null and undefined values.
 * 2. If the API endpoint is a REST path (starts with or contains '/'), the path is prepended.
 * 3. Parameter keys are sorted in alphabetical (ASCII) order.
 * 4. Each key and value is concatenated: key1value1key2value2...
 * 5. HMAC-SHA256 is computed using the appSecret and returned as an uppercase hexadecimal string.
 */
export function generateAliExpressSignature({ appSecret, apiName = "", params }: SignOptions): string {
  if (!appSecret) {
    throw new Error("appSecret is required to generate AliExpress signature.");
  }

  const baseString = buildSignatureBaseString(apiName, params);

  return crypto
    .createHmac("sha256", appSecret)
    .update(baseString, "utf8")
    .digest("hex")
    .toUpperCase();
}

/**
 * Builds the raw unhashed string to be signed.
 * Useful for debugging and testing against AliExpress test vectors.
 */
export function buildSignatureBaseString(
  apiName: string,
  params: Record<string, string | number | boolean | null | undefined>
): string {
  // Exclude 'sign' and null/undefined values
  const validEntries = Object.entries(params).filter(
    ([key, val]) => key !== "sign" && val !== undefined && val !== null
  );

  // Sort keys alphabetically in ASCII order
  validEntries.sort(([keyA], [keyB]) => (keyA < keyB ? -1 : keyA > keyB ? 1 : 0));

  let baseString = "";

  // If apiName contains '/', it is an IOP REST endpoint (e.g., /auth/token/create)
  if (apiName && apiName.includes("/")) {
    baseString += apiName;
  }

  // Concatenate sorted key+value
  for (const [key, val] of validEntries) {
    baseString += `${key}${String(val)}`;
  }

  return baseString;
}
