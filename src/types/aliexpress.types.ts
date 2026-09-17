/**
 * AliExpress Open Platform Raw API Types
 */

export interface AliExpressErrorResponse {
  code?: number | string;
  msg?: string;
  sub_code?: string;
  sub_msg?: string;
  request_id?: string;
}

export interface AliExpressRootError {
  error_response?: AliExpressErrorResponse;
}

/**
 * Token response returned by /auth/token/create and /auth/token/refresh
 */
export interface AliExpressTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expire_time: number;
  refresh_token_valid_time: number;
  refresh_expires_in?: number;
  user_id?: string;
  user_nick?: string;
  account_id?: string;
  sp?: string;
  locale?: string;
  havana_id?: string;
  account?: string;
  account_platform?: string;
  request_id?: string;
}

/**
 * Common Currency & Language codes supported by AliExpress
 */
export type AliExpressCurrency =
  | "USD"
  | "EUR"
  | "GBP"
  | "CAD"
  | "AUD"
  | "JPY"
  | "BRL"
  | "RUB"
  | "INR"
  | "MXN"
  | "TRY"
  | "UAH"
  | string;

export type AliExpressLanguage =
  | "EN"
  | "ES"
  | "FR"
  | "DE"
  | "IT"
  | "PT"
  | "RU"
  | "AR"
  | "JA"
  | "KO"
  | "NL"
  | "PL"
  | "TR"
  | "VI"
  | "TH"
  | "ID"
  | string;

/**
 * Parameters for calling aliexpress.ds.product.get
 */
export interface AliExpressProductGetParams {
  product_id: number | string;
  ship_to_country?: string;
  target_currency?: AliExpressCurrency;
  target_language?: AliExpressLanguage;
}

/**
 * Raw AliExpress SKU Property (e.g. Color, Size)
 */
export interface RawSkuProperty {
  sku_property_id: number;
  sku_property_name: string;
  property_value_id: number;
  property_value_definition_name?: string;
  sku_image?: string;
}

/**
 * Raw AliExpress Item SKU Info
 */
export interface RawItemSkuInfo {
  sku_id: string;
  sku_price: string;
  sku_stock: boolean | number;
  ipm_sku_stock?: number;
  sku_available_stock?: number;
  sku_code?: string;
  barcode?: string;
  offer_sale_price?: string;
  offer_bulk_sale_price?: string;
  aeop_s_k_u_propertys?: {
    ae_sku_property_d_t_o?: RawSkuProperty[];
  } | RawSkuProperty[];
  ae_sku_property_dtos?: RawSkuProperty[];
  currency_code?: string;
}

/**
 * Raw Item Attribute Property
 */
export interface RawItemProperty {
  attr_name_id: number;
  attr_name: string;
  attr_value_id: number;
  attr_value: string;
}

/**
 * Raw Video DTO
 */
export interface RawVideoDto {
  video_id: number | string;
  video_status: string;
  media_type: string;
  poster_url: string;
  video_url: string;
}

/**
 * Raw Multimedia Info
 */
export interface RawMultimediaInfo {
  image_urls?: string;
  ae_video_dtos?: {
    ae_video_d_t_o?: RawVideoDto[];
  } | RawVideoDto[];
}

/**
 * Raw Base Info DTO
 */
export interface RawItemBaseInfo {
  product_id: number;
  category_id: number;
  subject: string;
  currency_code: AliExpressCurrency;
  product_status_type: string;
  ws_display?: string;
  ws_offline_date?: string;
  gmt_create?: string;
  gmt_modified?: string;
  owner_member_seq_long?: number;
  evaluation_count?: string;
  avg_evaluation_rating?: string;
  detail?: string;
  mobile_detail?: string;
}

/**
 * Raw Logistics Info
 */
export interface RawLogisticsInfo {
  delivery_time?: number;
  ship_to_country?: string;
  shipping_fee?: string;
  logistics_company_name?: string;
}

/**
 * Raw Package Info
 */
export interface RawPackageInfo {
  package_type?: boolean;
  package_length?: number;
  package_height?: number;
  package_width?: number;
  gross_weight?: string;
}

/**
 * Raw result payload for aliexpress.ds.product.get
 */
export interface RawProductGetResult {
  ae_item_base_info_dto?: RawItemBaseInfo;
  ae_item_sku_info_dtos?: {
    ae_item_sku_info_d_t_o?: RawItemSkuInfo[];
  } | RawItemSkuInfo[];
  ae_item_properties?: {
    ae_item_property?: RawItemProperty[];
  } | RawItemProperty[];
  ae_multimedia_info_dto?: RawMultimediaInfo;
  package_info_dto?: RawPackageInfo;
  logistics_info_dto?: RawLogisticsInfo;
}

export interface RawAliExpressProductGetResponse {
  aliexpress_ds_product_get_response?: {
    result?: RawProductGetResult;
    rsp_code?: string;
    rsp_msg?: string;
    request_id?: string;
  };
  error_response?: AliExpressErrorResponse;
}
