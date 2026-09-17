import { describe, it, expect } from "vitest";
import { generateAliExpressSignature, buildSignatureBaseString } from "../src/core/signer.js";
import crypto from "crypto";

describe("AliExpress Signature Generator", () => {
  const testSecret = "test_app_secret_123456";

  it("should sort parameters in ASCII alphabetical order and concatenate key+value", () => {
    const params = {
      zebra: "last",
      apple: "first",
      middle: "center",
    };

    const baseString = buildSignatureBaseString("", params);
    expect(baseString).toBe("applefirstmiddlecenterzebralast");
  });

  it("should prepend REST api path when apiName contains '/'", () => {
    const params = {
      code: "auth_code_999",
      app_key: "12345678",
    };

    const baseString = buildSignatureBaseString("/auth/token/create", params);
    expect(baseString).toBe("/auth/token/createapp_key12345678codeauth_code_999");
  });

  it("should not prepend apiName when apiName does not contain '/' (TOP API)", () => {
    const params = {
      method: "aliexpress.ds.product.get",
      product_id: 100500123,
      app_key: "87654321",
    };

    const baseString = buildSignatureBaseString("aliexpress.ds.product.get", params);
    expect(baseString).toBe("app_key87654321methodaliexpress.ds.product.getproduct_id100500123");
  });

  it("should ignore null and undefined values and exclude 'sign'", () => {
    const params = {
      a: "valid",
      b: null,
      c: undefined,
      sign: "OLD_SIGNATURE_TO_EXCLUDE",
    };

    const baseString = buildSignatureBaseString("", params);
    expect(baseString).toBe("avalid");
  });

  it("should generate a valid uppercase hexadecimal HMAC-SHA256 signature", () => {
    const params = {
      app_key: "33124567",
      timestamp: "1710000000000",
      sign_method: "sha256",
    };

    const signature = generateAliExpressSignature({
      appSecret: testSecret,
      apiName: "/auth/token/create",
      params,
    });

    const expectedBaseString = "/auth/token/createapp_key33124567sign_methodsha256timestamp1710000000000";
    const expectedSign = crypto
      .createHmac("sha256", testSecret)
      .update(expectedBaseString, "utf8")
      .digest("hex")
      .toUpperCase();

    expect(signature).toBe(expectedSign);
    expect(signature).toMatch(/^[0-9A-F]{64}$/); // 64 hex characters, all uppercase
  });

  it("should throw an error if appSecret is missing", () => {
    expect(() =>
      generateAliExpressSignature({
        appSecret: "",
        apiName: "/test",
        params: { a: 1 },
      })
    ).toThrow("appSecret is required");
  });
});
