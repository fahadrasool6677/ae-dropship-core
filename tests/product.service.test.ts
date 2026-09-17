import { describe, it, expect, beforeEach, vi } from "vitest";
import { AliExpressProductService } from "../src/services/aliexpress-product.service.js";
import { AliExpressAuthService } from "../src/services/aliexpress-auth.service.js";
import { AliExpressHttpClient, AliExpressApiError } from "../src/core/http-client.js";
import { RawAliExpressProductGetResponse } from "../src/types/aliexpress.types.js";

describe("AliExpressProductService", () => {
  let mockHttpClient: AliExpressHttpClient;
  let mockAuthService: AliExpressAuthService;
  let productService: AliExpressProductService;

  beforeEach(() => {
    process.env.ALIEXPRESS_APP_KEY = "test_key_123";
    process.env.ALIEXPRESS_APP_SECRET = "test_secret_456";

    mockHttpClient = new AliExpressHttpClient();
    mockAuthService = new AliExpressAuthService(mockHttpClient);
    vi.spyOn(mockAuthService, "getValidAccessToken").mockResolvedValue("mock_valid_token_777");

    productService = new AliExpressProductService(mockHttpClient, mockAuthService);
  });

  it("should reject non-numeric product IDs", async () => {
    await expect(
      productService.getProductById({ product_id: "not-a-number" })
    ).rejects.toThrow(/Invalid AliExpress product ID/);

    await expect(
      productService.getProductById({ product_id: "" })
    ).rejects.toThrow(/Invalid AliExpress product ID/);
  });

  it("should successfully fetch and normalize a raw AliExpress product response", async () => {
    const mockRawResponse: RawAliExpressProductGetResponse = {
      aliexpress_ds_product_get_response: {
        rsp_code: "200",
        result: {
          ae_item_base_info_dto: {
            product_id: 1005006123456789,
            category_id: 509,
            subject: "Wireless Bluetooth 5.3 Earphones with Charging Case",
            currency_code: "USD",
            product_status_type: "onSelling",
            avg_evaluation_rating: "4.8",
            evaluation_count: "1250",
            detail: "<p>High fidelity stereo sound earphones.</p>",
          },
          ae_multimedia_info_dto: {
            image_urls: "https://ae01.alicdn.com/img1.jpg;https://ae01.alicdn.com/img2.jpg",
            ae_video_dtos: [
              {
                video_id: 12345,
                video_status: "active",
                media_type: "mp4",
                poster_url: "https://ae01.alicdn.com/poster.jpg",
                video_url: "https://ae01.alicdn.com/demo.mp4",
              },
            ],
          },
          ae_item_properties: [
            {
              attr_name_id: 10,
              attr_name: "Brand",
              attr_value_id: 100,
              attr_value: "TechAudio",
            },
            {
              attr_name_id: 14,
              attr_name: "Bluetooth Version",
              attr_value_id: 140,
              attr_value: "5.3",
            },
          ],
          ae_item_sku_info_dtos: [
            {
              sku_id: "1005006123456789:1",
              sku_price: "29.99",
              offer_sale_price: "19.99",
              sku_available_stock: 150,
              currency_code: "USD",
              ae_sku_property_dtos: [
                {
                  sku_property_id: 14,
                  sku_property_name: "Color",
                  property_value_id: 77,
                  property_value_definition_name: "Midnight Black",
                  sku_image: "https://ae01.alicdn.com/black.jpg",
                },
              ],
            },
            {
              sku_id: "1005006123456789:2",
              sku_price: "29.99",
              offer_sale_price: "21.99",
              sku_available_stock: 80,
              currency_code: "USD",
              ae_sku_property_dtos: [
                {
                  sku_property_id: 14,
                  sku_property_name: "Color",
                  property_value_id: 88,
                  property_value_definition_name: "Pearl White",
                  sku_image: "https://ae01.alicdn.com/white.jpg",
                },
              ],
            },
          ],
          package_info_dto: {
            package_type: false,
            package_length: 15,
            package_width: 10,
            package_height: 5,
            gross_weight: "0.25",
          },
          logistics_info_dto: {
            delivery_time: 12,
            ship_to_country: "US",
            shipping_fee: "0.00",
            logistics_company_name: "AliExpress Standard Shipping",
          },
        },
      },
    };

    vi.spyOn(mockHttpClient, "post").mockResolvedValueOnce(mockRawResponse);

    const product = await productService.getProductById({
      product_id: 1005006123456789,
      ship_to_country: "US",
      target_currency: "USD",
      target_language: "EN",
    });

    // Verification of normalized product
    expect(product.productId).toBe("1005006123456789");
    expect(product.title).toBe("Wireless Bluetooth 5.3 Earphones with Charging Case");
    expect(product.categoryId).toBe(509);
    expect(product.status).toBe("onSelling");
    expect(product.currency).toBe("USD");

    // Price range calculation
    expect(product.priceRange.minOriginalPrice).toBe(29.99);
    expect(product.priceRange.maxOriginalPrice).toBe(29.99);
    expect(product.priceRange.minSalePrice).toBe(19.99);
    expect(product.priceRange.maxSalePrice).toBe(21.99);

    // Stock
    expect(product.totalStock).toBe(230); // 150 + 80

    // Images and videos
    expect(product.images).toEqual([
      "https://ae01.alicdn.com/img1.jpg",
      "https://ae01.alicdn.com/img2.jpg",
    ]);
    expect(product.videos).toHaveLength(1);
    expect(product.videos[0].videoUrl).toBe("https://ae01.alicdn.com/demo.mp4");

    // Attributes
    expect(product.attributes).toHaveLength(2);
    expect(product.attributes[0].name).toBe("Brand");
    expect(product.attributes[0].value).toBe("TechAudio");

    // SKUs
    expect(product.skus).toHaveLength(2);
    expect(product.skus[0].skuId).toBe("1005006123456789:1");
    expect(product.skus[0].salePrice).toBe(19.99);
    expect(product.skus[0].properties[0].valueName).toBe("Midnight Black");

    // Shipping & Package info
    expect(product.shippingInfo?.shipToCountry).toBe("US");
    expect(product.shippingInfo?.estimatedDeliveryDays).toBe(12);
    expect(product.shippingInfo?.carrierName).toBe("AliExpress Standard Shipping");
    expect(product.packageInfo?.weightKg).toBe(0.25);

    // Ratings
    expect(product.rating?.averageRating).toBe(4.8);
    expect(product.rating?.totalReviews).toBe(1250);
  });

  it("should handle AliExpress API error responses gracefully", async () => {
    const errorResponse = new AliExpressApiError(
      "AliExpress API error: Item not found or offline (sub_code: isv.invalid-parameter, request_id: req_xyz999)",
      {
        code: 15,
        msg: "Remote service error",
        sub_code: "isv.invalid-parameter",
        sub_msg: "Item not found or offline",
        request_id: "req_xyz999",
      }
    );

    vi.spyOn(mockHttpClient, "post").mockRejectedValueOnce(errorResponse);

    await expect(
      productService.getProductById({ product_id: 999999999999 })
    ).rejects.toThrow(/Item not found or offline/);
  });
});
