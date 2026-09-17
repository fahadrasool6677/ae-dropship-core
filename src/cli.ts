#!/usr/bin/env tsx
import { AliExpressAuthService } from "./services/aliexpress-auth.service.js";
import { AliExpressProductService } from "./services/aliexpress-product.service.js";
import { TokenStore } from "./core/token-store.js";
import { getConfig } from "./config/env.js";

function printHelp(): void {
  console.log(`
AliExpress Dropshipping Integration - Command Line Interface (CLI)

Usage:
  npm run cli <command> [options]

Commands:
  auth-url                      Generate and display the OAuth authorization URL
  exchange <code>               Exchange authorization code from OAuth callback for access tokens
  refresh                       Refresh the stored access token
  status                        Show current token and credential configuration status
  preview                       Show the cached sample product (1005007879054168)
  get-item <itemId> [options]   Fetch product details by AliExpress Product ID

Options for get-item:
  --country <ISO2>              Destination country code (e.g. US, GB, ES, FR) [Default: US]
  --currency <CODE>             Pricing currency (e.g. USD, EUR, GBP) [Default: USD]
  --language <LANG>             Target language (e.g. EN, ES, FR, DE) [Default: EN]
  --raw                         Output complete raw AliExpress JSON response

Examples:
  npm run cli auth-url
  npm run cli exchange 3_500020_abcdef123456
  npm run cli status
  npm run get-item 1005006123456789
  npm run cli get-item 1005006123456789 --country US --currency USD
`);
}

function parseArgs(args: string[]): {
  command: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
} {
  const command = args[0] || "help";
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { command, positionals, flags };
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const { command, positionals, flags } = parseArgs(rawArgs);

  const authService = new AliExpressAuthService();
  const productService = new AliExpressProductService(undefined, authService);

  switch (command.toLowerCase()) {
    case "auth-url": {
      try {
        const url = authService.getAuthorizationUrl();
        console.log("\n=======================================================");
        console.log("🔗 AliExpress OAuth 2.0 Authorization URL:");
        console.log("=======================================================");
        console.log(url);
        console.log("\nInstructions:");
        console.log("1. Open the URL above in your browser.");
        console.log("2. Sign in and authorize your AliExpress application.");
        console.log("3. You will be redirected to your configured redirect URI with ?code=YOUR_AUTH_CODE.");
        console.log("4. Run: npm run cli exchange <YOUR_AUTH_CODE>");
        console.log("=======================================================\n");
      } catch (err) {
        console.error("\n❌ Configuration Error:", (err as Error).message);
        process.exit(1);
      }
      break;
    }

    case "exchange": {
      const code = positionals[0] || (flags.code as string);
      if (!code) {
        console.error("❌ Error: Missing authorization code.");
        console.log("Usage: npm run cli exchange <auth_code>");
        process.exit(1);
      }

      try {
        console.log(`\nExchanging code: "${code}" for access token...`);
        const result = await authService.exchangeCodeForToken(code);
        console.log("\n=======================================================");
        console.log("✅ Authorization Successful!");
        console.log("=======================================================");
        console.log(`User Nick:    ${result.userNick || "N/A"}`);
        console.log(`User ID:      ${result.userId || "N/A"}`);
        console.log(
          `Expires At:   ${result.expiresAt ? new Date(result.expiresAt).toLocaleString() : "N/A"}`
        );
        console.log(`Stored In:    .token.json`);
        console.log("=======================================================\n");
      } catch (err) {
        console.error("\n❌ Token Exchange Failed:", (err as Error).message);
        process.exit(1);
      }
      break;
    }

    case "refresh": {
      try {
        console.log("\nRefreshing AliExpress access token...");
        const result = await authService.refreshToken();
        console.log("\n=======================================================");
        console.log("✅ Token Refreshed Successfully!");
        console.log("=======================================================");
        console.log(
          `Expires At:   ${result.expiresAt ? new Date(result.expiresAt).toLocaleString() : "N/A"}`
        );
        console.log("=======================================================\n");
      } catch (err) {
        console.error("\n❌ Token Refresh Failed:", (err as Error).message);
        process.exit(1);
      }
      break;
    }

    case "status": {
      const config = getConfig();
      const tokenStatus = authService.getTokenStatus();

      console.log("\n=======================================================");
      console.log("📊 Configuration & Token Status");
      console.log("=======================================================");
      console.log(
        `App Key:         ${config.appKey && config.appKey !== "your_app_key_here" ? config.appKey : "❌ Not configured"}`
      );
      console.log(
        `App Secret:      ${config.appSecret && config.appSecret !== "your_app_secret_here" ? "••••••••" + config.appSecret.slice(-4) : "❌ Not configured"}`
      );
      console.log(`Redirect URI:    ${config.redirectUri}`);
      console.log(
        `Access Token:    ${tokenStatus.hasAccessToken ? "✅ Active" : "❌ None found"}`
      );
      console.log(
        `Refresh Token:   ${tokenStatus.hasRefreshToken ? "✅ Active" : "❌ None found"}`
      );
      if (tokenStatus.expiresAt) {
        console.log(`Expires At:      ${tokenStatus.expiresAt}`);
        console.log(`Is Expired:      ${tokenStatus.isExpired ? "⚠️ Yes" : "No"}`);
      }
      if (tokenStatus.userNick) {
        console.log(`User Nick:       ${tokenStatus.userNick}`);
      }
      console.log("=======================================================\n");
      break;
    }

    case "get-item": {
      const itemId = positionals[0] || (flags.id as string);
      if (!itemId) {
        console.error("❌ Error: Missing product ID.");
        console.log("Usage: npm run get-item <itemId> [--country US] [--currency USD]");
        process.exit(1);
      }

      const country = (flags.country as string) || "US";
      const currency = (flags.currency as string) || "USD";
      const language = (flags.language as string) || "EN";
      const raw = Boolean(flags.raw);

      console.log("\n=======================================================");
      console.log(`🔍 Fetching AliExpress Product [ID: ${itemId}]`);
      console.log(`   Ship To: ${country} | Currency: ${currency} | Language: ${language}`);
      console.log("=======================================================");

      try {
        if (raw) {
          const rawResponse = await productService.getRawProductById({
            product_id: itemId,
            ship_to_country: country,
            target_currency: currency,
            target_language: language,
          });
          console.log(JSON.stringify(rawResponse, null, 2));
        } else {
          const product = await productService.getProductById({
            product_id: itemId,
            ship_to_country: country,
            target_currency: currency,
            target_language: language,
          });

          console.log("\n📦 PRODUCT DETAILS");
          console.log(`Title:          ${product.title}`);
          console.log(`Product ID:     ${product.productId}`);
          console.log(`Category ID:    ${product.categoryId}`);
          console.log(`Status:         ${product.status}`);
          console.log(
            `Sale Price:     ${product.currency} ${product.priceRange.minSalePrice.toFixed(2)} - ${product.priceRange.maxSalePrice.toFixed(2)}`
          );
          console.log(
            `Original Price: ${product.currency} ${product.priceRange.minOriginalPrice.toFixed(2)} - ${product.priceRange.maxOriginalPrice.toFixed(2)}`
          );
          console.log(`Total Stock:    ${product.totalStock} units`);
          console.log(`Variations:     ${product.skus.length} SKU(s)`);
          console.log(`Images:         ${product.images.length} image(s)`);
          console.log(`Videos:         ${product.videos.length} video(s)`);
          if (product.rating && product.rating.averageRating > 0) {
            console.log(
              `Reviews:        ${product.rating.averageRating} ★ (${product.rating.totalReviews} reviews)`
            );
          }
          if (product.shippingInfo) {
            console.log(
              `Shipping:       ${product.shippingInfo.estimatedDeliveryDays || "?"} days to ${product.shippingInfo.shipToCountry || country} (Fee: ${product.currency} ${product.shippingInfo.shippingFee ?? 0})`
            );
          }

          if (product.skus.length > 0) {
            console.log("\n📋 SAMPLE SKU VARIATIONS (Up to 5):");
            for (const sku of product.skus.slice(0, 5)) {
              const variantNames = sku.properties
                .map((p) => `${p.propertyName}: ${p.valueName}`)
                .join(" | ");
              console.log(
                ` - SKU [${sku.skuId}]: ${product.currency} ${sku.salePrice.toFixed(2)} (Stock: ${sku.availableStock}) ${variantNames ? `[${variantNames}]` : ""}`
              );
            }
          }

          if (product.images.length > 0) {
            console.log(`\n🖼️ Primary Image URL: ${product.images[0]}`);
          }
        }
        console.log("\n=======================================================");
        console.log("✅ Operation completed successfully.");
        console.log("=======================================================\n");
      } catch (err) {
        console.error("\n❌ API Call Failed:\n");
        console.error((err as Error).message);
        console.log("\nTroubleshooting Tips:");
        console.log("1. Check if your ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET in .env are valid.");
        console.log("2. Check if your application has been approved for the AE-Dropshipper API.");
        console.log("3. Complete authorization with: npm run cli auth-url");
        console.log("4. Ensure product ID is valid and currently active on AliExpress.\n");
        process.exit(1);
      }
      break;
    }

    case "preview": {
      const fs = await import("fs");
      const path = await import("path");
      const sampleFile = path.resolve(process.cwd(), "data", "sample-product-1005007879054168.json");
      if (!fs.existsSync(sampleFile)) {
        console.error("❌ Sample file not found at data/sample-product-1005007879054168.json");
        process.exit(1);
      }
      const sample = JSON.parse(fs.readFileSync(sampleFile, "utf-8"));
      const product = sample.normalized;

      console.log("\n=======================================================");
      console.log(`📦 PREVIEW: SAVED SAMPLE PRODUCT`);
      console.log(`   Source URL: ${sample.itemUrl}`);
      console.log(`   Saved At:   ${sample.fetchedAt}`);
      console.log("=======================================================");
      console.log(`Title:          ${product.title}`);
      console.log(`Product ID:     ${product.productId}`);
      console.log(`Category ID:    ${product.categoryId}`);
      console.log(`Status:         ${product.status}`);
      console.log(`Sale Price:     ${product.currency} ${product.priceRange.minSalePrice.toFixed(2)} - ${product.priceRange.maxSalePrice.toFixed(2)}`);
      console.log(`Original Price: ${product.currency} ${product.priceRange.minOriginalPrice.toFixed(2)} - ${product.priceRange.maxOriginalPrice.toFixed(2)}`);
      console.log(`Total Stock:    ${product.totalStock} units`);
      console.log(`Variations:     ${product.skus.length} SKU(s)`);
      console.log(`Images:         ${product.images.length} image(s)`);
      if (product.images.length > 0) {
        console.log(`Primary Image:  ${product.images[0]}`);
      }
      console.log(`File Saved At:  data/sample-product-1005007879054168.json`);
      console.log("=======================================================\n");
      break;
    }

    default:
      printHelp();
      break;
  }
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
