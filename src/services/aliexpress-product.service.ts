import { validateCredentials } from "../config/env.js";
import { AliExpressHttpClient } from "../core/http-client.js";
import { AliExpressAuthService } from "./aliexpress-auth.service.js";
import {
  AliExpressProductGetParams,
  RawAliExpressProductGetResponse,
  RawItemProperty,
  RawItemSkuInfo,
  RawSkuProperty,
  RawVideoDto,
} from "../types/aliexpress.types.js";
import {
  NormalizedProduct,
  NormalizedProductAttribute,
  NormalizedSku,
  NormalizedSkuVariantProperty,
  NormalizedVideo,
} from "../types/product.types.js";

export class AliExpressProductService {
  private httpClient: AliExpressHttpClient;
  private authService: AliExpressAuthService;

  constructor(
    httpClient?: AliExpressHttpClient,
    authService?: AliExpressAuthService
  ) {
    this.httpClient = httpClient || new AliExpressHttpClient();
    this.authService = authService || new AliExpressAuthService(this.httpClient);
  }

  /**
   * Retrieves full product details from AliExpress by Item ID and normalizes the output.
   *
   * @param params Request options including product_id, ship_to_country, target_currency, target_language
   * @returns Clean, normalized product structure tailored for dropshipping
   */
  public async getProductById(
    params: AliExpressProductGetParams
  ): Promise<NormalizedProduct> {
    const rawResponse = await this.getRawProductById(params);
    return this.normalizeProductResponse(rawResponse);
  }

  /**
   * Calls the official `aliexpress.ds.product.get` API and returns the raw response structure.
   */
  public async getRawProductById(
    params: AliExpressProductGetParams
  ): Promise<RawAliExpressProductGetResponse> {
    const productIdStr = String(params.product_id).trim();

    if (!productIdStr || !/^\d+$/.test(productIdStr)) {
      throw new Error(
        `Invalid AliExpress product ID: "${params.product_id}". Product ID must be numeric (e.g. 1005006123456789).`
      );
    }

    const { appKey, appSecret } = validateCredentials();
    const session = await this.authService.getValidAccessToken();

    const queryParams: Record<string, string | number | boolean | null | undefined> = {
      product_id: productIdStr,
    };

    if (params.ship_to_country) {
      queryParams.ship_to_country = params.ship_to_country.toUpperCase();
    }

    if (params.target_currency) {
      queryParams.target_currency = params.target_currency.toUpperCase();
    }

    if (params.target_language) {
      queryParams.target_language = params.target_language.toUpperCase();
    }

    console.log(
      `[AliExpressProductService] Fetching product ID ${productIdStr} (Country: ${params.ship_to_country || "DEFAULT"}, Currency: ${params.target_currency || "DEFAULT"})...`
    );

    const response = await this.httpClient.post<RawAliExpressProductGetResponse>({
      apiName: "aliexpress.ds.product.get",
      appKey,
      appSecret,
      session,
      params: queryParams,
    });

    if (process.env.DEBUG === "true" || process.env.NODE_ENV === "development") {
      console.log("[AliExpressProductService] Raw response:", JSON.stringify(response, null, 2));
    }

    const rawObj = response as any;
    if (rawObj?.rsp_code && rawObj.rsp_code !== 200 && rawObj.rsp_code !== "200") {
      const msg = rawObj.rsp_msg || "Error";
      throw new Error(
        `AliExpress API error: Product ID ${productIdStr} - ${msg} (code: ${rawObj.rsp_code}, request_id: ${rawObj.request_id || "none"})`
      );
    }

    const result = rawObj?.result || rawObj?.aliexpress_ds_product_get_response?.result;

    if (!result) {
      const rspMsg = rawObj?.rsp_msg || rawObj?.aliexpress_ds_product_get_response?.rsp_msg;
      const rspCode = rawObj?.rsp_code || rawObj?.aliexpress_ds_product_get_response?.rsp_code;
      throw new Error(
        `AliExpress returned empty product details for ID ${productIdStr}. Response code: ${rspCode || "none"}, message: ${rspMsg || "no product found or unauthorized"}`
      );
    }

    return response;
  }

  /**
   * Normalizes the raw, deeply-nested AliExpress API response into an intuitive domain model.
   */
  public normalizeProductResponse(
    response: RawAliExpressProductGetResponse
  ): NormalizedProduct {
    const rawObj = response as any;
    const result = rawObj?.result || rawObj?.aliexpress_ds_product_get_response?.result;

    if (!result) {
      throw new Error("Cannot normalize product: result object is missing from response.");
    }

    const baseInfo = result.ae_item_base_info_dto;
    const multimedia = result.ae_multimedia_info_dto;
    const packageInfo = result.package_info_dto;
    const logistics = result.logistics_info_dto;

    // 1. Parse Image URLs (AliExpress often returns semicolon-delimited URLs)
    const images: string[] = [];
    if (multimedia?.image_urls && typeof multimedia.image_urls === "string") {
      const splitUrls = multimedia.image_urls
        .split(";")
        .map((u: string) => u.trim())
        .filter((u: string) => u.length > 0);
      images.push(...splitUrls);
    }

    // 2. Parse Videos
    const videos: NormalizedVideo[] = [];
    const rawVideoList: RawVideoDto[] = Array.isArray(multimedia?.ae_video_dtos)
      ? multimedia!.ae_video_dtos as RawVideoDto[]
      : multimedia?.ae_video_dtos?.ae_video_d_t_o || [];

    for (const v of rawVideoList) {
      if (v.video_url) {
        videos.push({
          id: String(v.video_id),
          posterUrl: v.poster_url,
          videoUrl: v.video_url,
        });
      }
    }

    // 3. Parse Item Attributes/Properties
    const attributes: NormalizedProductAttribute[] = [];
    const rawAttrList: RawItemProperty[] = Array.isArray(result.ae_item_properties)
      ? result.ae_item_properties as RawItemProperty[]
      : result.ae_item_properties?.ae_item_property || [];

    for (const attr of rawAttrList) {
      attributes.push({
        id: attr.attr_name_id,
        name: attr.attr_name,
        valueId: attr.attr_value_id,
        value: attr.attr_value,
      });
    }

    // 4. Parse SKUs (Variations, Prices, Stock)
    const skus: NormalizedSku[] = [];
    const rawSkuList: RawItemSkuInfo[] = Array.isArray(result.ae_item_sku_info_dtos)
      ? result.ae_item_sku_info_dtos as RawItemSkuInfo[]
      : result.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || [];

    let totalStock = 0;
    let minOriginalPrice = Infinity;
    let maxOriginalPrice = 0;
    let minSalePrice = Infinity;
    let maxSalePrice = 0;

    for (const rawSku of rawSkuList) {
      const originalPrice = parseFloat(rawSku.sku_price) || 0;
      const salePrice = rawSku.offer_sale_price
        ? parseFloat(rawSku.offer_sale_price)
        : originalPrice;

      const availableStock =
        typeof rawSku.ipm_sku_stock === "number"
          ? rawSku.ipm_sku_stock
          : typeof rawSku.sku_available_stock === "number"
          ? rawSku.sku_available_stock
          : typeof rawSku.sku_stock === "number"
          ? rawSku.sku_stock
          : rawSku.sku_stock === true
          ? 999
          : 0;

      totalStock += availableStock;

      if (originalPrice > 0) {
        minOriginalPrice = Math.min(minOriginalPrice, originalPrice);
        maxOriginalPrice = Math.max(maxOriginalPrice, originalPrice);
      }
      if (salePrice > 0) {
        minSalePrice = Math.min(minSalePrice, salePrice);
        maxSalePrice = Math.max(maxSalePrice, salePrice);
      }

      // Parse SKU Variant Properties (Color, Size, etc.)
      const skuProperties: NormalizedSkuVariantProperty[] = [];
      const rawProperties: RawSkuProperty[] = Array.isArray(rawSku.ae_sku_property_dtos)
        ? rawSku.ae_sku_property_dtos
        : Array.isArray(rawSku.aeop_s_k_u_propertys)
        ? rawSku.aeop_s_k_u_propertys
        : rawSku.aeop_s_k_u_propertys?.ae_sku_property_d_t_o || [];

      for (const p of rawProperties) {
        skuProperties.push({
          propertyId: p.sku_property_id,
          propertyName: p.sku_property_name,
          valueId: p.property_value_id,
          valueName: p.property_value_definition_name || String(p.property_value_id),
          skuImage: p.sku_image,
        });
      }

      skus.push({
        skuId: rawSku.sku_id,
        originalPrice,
        salePrice,
        currency: rawSku.currency_code || baseInfo?.currency_code || "USD",
        availableStock,
        skuCode: rawSku.sku_code,
        barcode: rawSku.barcode,
        properties: skuProperties,
      });
    }

    if (minOriginalPrice === Infinity) minOriginalPrice = 0;
    if (minSalePrice === Infinity) minSalePrice = 0;

    return {
      productId: String(baseInfo?.product_id || ""),
      title: baseInfo?.subject || "",
      categoryId: baseInfo?.category_id || 0,
      status: baseInfo?.product_status_type || "UNKNOWN",
      currency: baseInfo?.currency_code || "USD",
      priceRange: {
        minOriginalPrice,
        maxOriginalPrice,
        minSalePrice,
        maxSalePrice,
      },
      totalStock,
      images,
      videos,
      attributes,
      skus,
      packageInfo: packageInfo
        ? {
            isCustomPackage: Boolean(packageInfo.package_type),
            lengthCm: packageInfo.package_length || 0,
            widthCm: packageInfo.package_width || 0,
            heightCm: packageInfo.package_height || 0,
            weightKg: parseFloat(packageInfo.gross_weight || "0"),
          }
        : undefined,
      shippingInfo: logistics
        ? {
            estimatedDeliveryDays: logistics.delivery_time,
            shipToCountry: logistics.ship_to_country,
            shippingFee: logistics.shipping_fee ? parseFloat(logistics.shipping_fee) : 0,
            carrierName: logistics.logistics_company_name,
          }
        : undefined,
      descriptionHtml: baseInfo?.detail || baseInfo?.mobile_detail,
      rating: {
        averageRating: parseFloat(baseInfo?.avg_evaluation_rating || "0"),
        totalReviews: parseInt(baseInfo?.evaluation_count || "0", 10),
      },
      createdAt: baseInfo?.gmt_create,
      updatedAt: baseInfo?.gmt_modified,
      rawResponse: response,
    };
  }
}
