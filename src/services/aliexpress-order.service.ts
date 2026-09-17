import { validateCredentials } from "../config/env.js";
import { AliExpressHttpClient, AliExpressApiError } from "../core/http-client.js";
import { AliExpressAuthService } from "./aliexpress-auth.service.js";
import {
  AllOrdersResult,
  NormalizedLogisticsInfo,
  NormalizedMoney,
  NormalizedOrder,
  NormalizedOrderItem,
  NormalizedShippingAddress,
  NormalizedStoreInfo,
  OrderPaginationMetadata,
  OrderQueryDateRangeParams,
  PaginatedOrdersResult,
  RawAeopOrderDetailResult,
  RawAeopOrderItem,
  RawAeopOrderLogisticsInfo,
  RawAeopOrderReceiverInfo,
  RawAliExpressOrderDetailResponse,
  RawAliExpressOrderListResponse,
  RawOrderSummaryItem,
} from "../types/order.types.js";

export class AliExpressOrderService {
  private httpClient: AliExpressHttpClient;
  private authService: AliExpressAuthService;

  constructor(
    httpClient?: AliExpressHttpClient,
    authService?: AliExpressAuthService
  ) {
    this.httpClient = httpClient || new AliExpressHttpClient();
    this.authService = authService || new AliExpressAuthService(this.httpClient);
  }

  // ==========================================================================
  // Public Order APIs
  // ==========================================================================

  /**
   * Retrieves full details for a specific purchased order by its AliExpress Order ID.
   *
   * @param orderId Numeric AliExpress order ID (e.g. 1000000001 or "1000000001")
   * @param options Optional flags (e.g. attach raw response)
   * @returns Clean, normalized domain order model
   */
  public async getOrderById(
    orderId: string | number,
    options?: { raw?: boolean }
  ): Promise<NormalizedOrder> {
    const rawResponse = await this.getRawOrderById(orderId);
    const normalized = this.normalizeOrderDetailResponse(rawResponse);

    if (options?.raw) {
      normalized.raw = rawResponse;
    }

    return normalized;
  }

  /**
   * Calls the official AliExpress dropshipper order details API (`aliexpress.trade.ds.order.get`)
   * and returns the raw response structure.
   */
  public async getRawOrderById(
    orderId: string | number
  ): Promise<RawAliExpressOrderDetailResponse> {
    const orderIdStr = String(orderId).trim();

    if (!orderIdStr || !/^\d+$/.test(orderIdStr)) {
      throw new Error(
        `Invalid AliExpress Order ID: "${orderId}". Order ID must be a numeric string (e.g. "123456789012345").`
      );
    }

    const { appKey, appSecret } = validateCredentials();
    const session = await this.authService.getValidAccessToken();

    console.log(`[AliExpressOrderService] Fetching order details for ID: ${orderIdStr}...`);

    // AliExpress dropshipping order query payload
    const singleOrderQuery = JSON.stringify({
      order_id: orderIdStr,
    });

    let response: RawAliExpressOrderDetailResponse;
    try {
      response = await this.httpClient.post<RawAliExpressOrderDetailResponse>({
        apiName: "aliexpress.trade.ds.order.get",
        appKey,
        appSecret,
        session,
        params: {
          single_order_query: singleOrderQuery,
        },
      });
    } catch (primaryErr) {
      // Compatibility fallback: try direct order_id parameter or solution endpoint if single_order_query is rejected
      if (process.env.DEBUG === "true") {
        console.warn(
          "[AliExpressOrderService] single_order_query attempt failed, trying fallback:",
          (primaryErr as Error).message
        );
      }

      try {
        response = await this.httpClient.post<RawAliExpressOrderDetailResponse>({
          apiName: "aliexpress.solution.order.info.get",
          appKey,
          appSecret,
          session,
          params: {
            param0: JSON.stringify({ order_id: orderIdStr }),
          },
        });
      } catch (fallbackErr) {
        throw primaryErr; // Rethrow original error with descriptive context
      }
    }

    const rawObj = response as any;
    if (rawObj?.rsp_code && rawObj.rsp_code !== 200 && rawObj.rsp_code !== "200") {
      const msg = rawObj.rsp_msg || "Error fetching order";
      throw new AliExpressApiError(
        `AliExpress API error: Order ID ${orderIdStr} - ${msg} (code: ${rawObj.rsp_code})`,
        {
          code: rawObj.rsp_code,
          msg: rawObj.rsp_msg,
          request_id: rawObj.request_id,
        }
      );
    }

    const result =
      rawObj?.result ||
      rawObj?.aliexpress_trade_ds_order_get_response?.result ||
      rawObj?.aliexpress_solution_order_info_get_response?.result;

    if (!result || (!result.order_id && !result.child_order_list)) {
      const rspMsg =
        rawObj?.rsp_msg ||
        rawObj?.aliexpress_trade_ds_order_get_response?.rsp_msg ||
        rawObj?.aliexpress_solution_order_info_get_response?.rsp_msg;
      throw new Error(
        `Order not found or unauthorized: AliExpress returned empty details for Order ID "${orderIdStr}". ${rspMsg ? `Message: ${rspMsg}` : ""}`.trim()
      );
    }

    return response;
  }

  /**
   * Retrieves purchased AliExpress orders for the authenticated account within a date/time range.
   * Supports pagination, status filtering, and date formatting.
   *
   * @param params Query parameters including startDate, endDate, page, pageSize, orderStatus
   * @returns Paginated list of normalized domain orders
   */
  public async getOrdersByDateRange(
    params: OrderQueryDateRangeParams
  ): Promise<PaginatedOrdersResult> {
    const { startDate, endDate, page = 1, pageSize = 20, orderStatus, raw } = params;

    // Format & validate date boundaries
    const startFormatted = this.formatAliExpressDateTime(startDate, false);
    const endFormatted = this.formatAliExpressDateTime(endDate, true);
    this.validateDateRange(startFormatted, endFormatted);

    // Validate pagination constraints
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const safePageSize = Math.min(50, Math.max(1, Math.floor(Number(pageSize) || 20)));

    const { appKey, appSecret } = validateCredentials();
    const session = await this.authService.getValidAccessToken();

    console.log(
      `[AliExpressOrderService] Fetching orders from ${startFormatted} to ${endFormatted} (Page: ${safePage}, PageSize: ${safePageSize})...`
    );

    const queryPayload: Record<string, unknown> = {
      create_date_start: startFormatted,
      create_date_end: endFormatted,
      current_page: safePage,
      page_size: safePageSize,
    };

    if (orderStatus && orderStatus.trim() !== "") {
      queryPayload.order_status = orderStatus.trim();
    }

    let response: RawAliExpressOrderListResponse;
    try {
      response = await this.httpClient.post<RawAliExpressOrderListResponse>({
        apiName: "aliexpress.solution.order.get",
        appKey,
        appSecret,
        session,
        params: {
          param0: JSON.stringify(queryPayload),
        },
      });
    } catch (primaryErr) {
      // Fallback: try trade seller orderlist endpoint if solution endpoint is unavailable
      if (process.env.DEBUG === "true") {
        console.warn(
          "[AliExpressOrderService] aliexpress.solution.order.get failed, trying fallback:",
          (primaryErr as Error).message
        );
      }

      try {
        response = await this.httpClient.post<RawAliExpressOrderListResponse>({
          apiName: "aliexpress.trade.seller.orderlist.get",
          appKey,
          appSecret,
          session,
          params: {
            param_aeop_order_query: JSON.stringify({
              create_date_start: startFormatted,
              create_date_end: endFormatted,
              page: safePage,
              page_size: safePageSize,
              ...(orderStatus ? { order_status: orderStatus.trim() } : {}),
            }),
          },
        });
      } catch (fallbackErr) {
        throw primaryErr;
      }
    }

    return this.normalizeOrderListResponse(response, safePage, safePageSize, raw);
  }

  /**
   * Helper that automatically retrieves ALL pages for a specified date range.
   * Includes safety cap on maximum pages to prevent infinite loops.
   *
   * @param params Query parameters (excluding page, with optional maxPages cap)
   * @returns Consolidated collection of all retrieved orders
   */
  public async getAllOrdersByDateRange(
    params: Omit<OrderQueryDateRangeParams, "page" | "fetchAll"> & { maxPages?: number }
  ): Promise<AllOrdersResult> {
    const maxPages = Math.min(50, Math.max(1, params.maxPages || 20));
    const allOrders: NormalizedOrder[] = [];

    let currentPage = 1;
    let pagesFetched = 0;
    let hasNext = true;
    let totalCount = 0;

    console.log(
      `[AliExpressOrderService] Auto-paginating all orders between ${String(params.startDate)} and ${String(params.endDate)} (Max pages: ${maxPages})...`
    );

    while (hasNext && currentPage <= maxPages) {
      const pageResult = await this.getOrdersByDateRange({
        ...params,
        page: currentPage,
        pageSize: params.pageSize || 50,
      });

      pagesFetched++;
      allOrders.push(...pageResult.orders);
      totalCount = pageResult.pagination.totalCount;
      hasNext = pageResult.pagination.hasNextPage;

      if (!hasNext || pageResult.orders.length === 0) {
        break;
      }

      currentPage++;
    }

    return {
      orders: allOrders,
      totalOrders: totalCount || allOrders.length,
      pagesFetched,
      startDate: this.formatAliExpressDateTime(params.startDate, false),
      endDate: this.formatAliExpressDateTime(params.endDate, true),
    };
  }

  // ==========================================================================
  // Date Handling & Validation Utilities
  // ==========================================================================

  /**
   * Converts input date (ISO string, Date instance, or YYYY-MM-DD) into standard
   * AliExpress format: `YYYY-MM-DD HH:mm:ss`.
   *
   * @param input Date input
   * @param isEndOfDay If true and only date is provided, sets time to 23:59:59
   */
  public formatAliExpressDateTime(
    input: string | Date,
    isEndOfDay = false
  ): string {
    if (!input) {
      throw new Error("Missing required date parameter.");
    }

    if (input instanceof Date) {
      if (isNaN(input.getTime())) {
        throw new Error("Invalid Date object provided.");
      }
      return this.formatDateComponents(input);
    }

    const trimmed = String(input).trim();

    // Case 1: Already formatted as YYYY-MM-DD HH:mm:ss
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Case 2: Simple Date format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const timePart = isEndOfDay ? "23:59:59" : "00:00:00";
      return `${trimmed} ${timePart}`;
    }

    // Case 3: ISO 8601 or parseable date string
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      throw new Error(
        `Invalid date format: "${trimmed}". Expected YYYY-MM-DD, YYYY-MM-DD HH:mm:ss, or ISO 8601 string.`
      );
    }

    return this.formatDateComponents(parsed);
  }

  private formatDateComponents(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getUTCFullYear();
    const month = pad(d.getUTCMonth() + 1);
    const day = pad(d.getUTCDate());
    const hours = pad(d.getUTCHours());
    const minutes = pad(d.getUTCMinutes());
    const seconds = pad(d.getUTCSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Validates date ordering and maximum allowed time window (up to 180 days).
   */
  public validateDateRange(startFormatted: string, endFormatted: string): void {
    const startMs = new Date(startFormatted.replace(" ", "T") + "Z").getTime();
    const endMs = new Date(endFormatted.replace(" ", "T") + "Z").getTime();

    if (startMs > endMs) {
      throw new Error(
        `Invalid date range: Start date (${startFormatted}) must be earlier than or equal to End date (${endFormatted}).`
      );
    }

    const maxDays = 180;
    const diffDays = (endMs - startMs) / (1000 * 60 * 60 * 24);
    if (diffDays > maxDays) {
      throw new Error(
        `Date range exceeds maximum allowed window of ${maxDays} days (requested: ${Math.round(diffDays)} days). Please narrow your query window.`
      );
    }
  }

  // ==========================================================================
  // Normalization Helpers
  // ==========================================================================

  /**
   * Normalizes raw order detail response into clean NormalizedOrder model.
   */
  public normalizeOrderDetailResponse(
    response: RawAliExpressOrderDetailResponse
  ): NormalizedOrder {
    const rawObj = response as any;
    const result: RawAeopOrderDetailResult =
      rawObj?.result ||
      rawObj?.aliexpress_trade_ds_order_get_response?.result ||
      rawObj?.aliexpress_solution_order_info_get_response?.result ||
      {};

    const orderId = String(result.order_id || "");
    const orderStatus = String(result.order_status || "UNKNOWN");

    const orderAmount = this.normalizeMoney(result.order_amount);
    const logisticsAmount = this.normalizeMoney(result.logistics_amount);

    // Extract child orders / items
    const rawItems: RawAeopOrderItem[] = Array.isArray(result.child_order_list)
      ? result.child_order_list
      : result.child_order_list?.aeop_child_order_info || [];

    const items: NormalizedOrderItem[] = rawItems.map((item) =>
      this.normalizeOrderItem(item)
    );

    // Extract logistics info
    const rawLogistics: RawAeopOrderLogisticsInfo[] = Array.isArray(
      result.logistics_info_list
    )
      ? result.logistics_info_list
      : result.logistics_info_list?.aeop_order_logistics_info || [];

    const logistics: NormalizedLogisticsInfo[] = rawLogistics.map((log) => ({
      trackingNumber: log.tracking_no || log.logistics_no || undefined,
      logisticsServiceName: log.logistics_service || undefined,
      status: log.recv_status || undefined,
      dispatchedAt: log.gmt_send || undefined,
    }));

    // Extract receiver address
    const shippingAddress = this.normalizeAddress(result.receipt_address);

    // Extract store info
    const storeInfo: NormalizedStoreInfo | undefined = result.store_info
      ? {
          storeId: result.store_info.store_id
            ? String(result.store_info.store_id)
            : undefined,
          storeName: result.store_info.store_name || undefined,
          storeUrl: result.store_info.store_url || undefined,
        }
      : undefined;

    return {
      orderId,
      orderStatus,
      createdAt: this.toIsoString(result.gmt_create),
      modifiedAt: this.toIsoString(result.gmt_modified),
      paidAt: this.toIsoString(result.gmt_pay_time),
      shippedAt: this.toIsoString(result.gmt_send_goods_time),
      orderAmount,
      logisticsAmount,
      storeInfo,
      shippingAddress,
      logistics: logistics.length > 0 ? logistics : undefined,
      items,
    };
  }

  /**
   * Normalizes raw order list response into PaginatedOrdersResult.
   */
  public normalizeOrderListResponse(
    response: RawAliExpressOrderListResponse,
    requestedPage: number,
    requestedPageSize: number,
    includeRaw?: boolean
  ): PaginatedOrdersResult {
    const rawObj = response as any;
    const result =
      rawObj?.result ||
      rawObj?.aliexpress_solution_order_get_response?.result ||
      rawObj?.aliexpress_trade_seller_orderlist_get_response?.result ||
      {};

    let rawList: RawOrderSummaryItem[] = [];
    if (Array.isArray(result.target_list)) {
      rawList = result.target_list;
    } else if (result.target_list?.aeop_order_dto) {
      rawList = Array.isArray(result.target_list.aeop_order_dto)
        ? result.target_list.aeop_order_dto
        : [result.target_list.aeop_order_dto];
    } else if (Array.isArray(result.order_list)) {
      rawList = result.order_list;
    } else if (result.order_list?.order_dto) {
      rawList = Array.isArray(result.order_list.order_dto)
        ? result.order_list.order_dto
        : [result.order_list.order_dto];
    }

    const orders: NormalizedOrder[] = rawList.map((item) =>
      this.normalizeOrderSummaryItem(item)
    );

    const totalCount = Number(result.total_count) || orders.length;
    const currentPage = Number(result.current_page) || requestedPage;
    const pageSize = Number(result.page_size) || requestedPageSize;
    const totalPages =
      Number(result.total_page) || Math.ceil(totalCount / (pageSize || 1)) || 1;
    const hasNextPage = currentPage < totalPages;

    const pagination: OrderPaginationMetadata = {
      currentPage,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage,
    };

    return {
      orders,
      pagination,
      ...(includeRaw ? { raw: response } : {}),
    };
  }

  private normalizeOrderSummaryItem(item: RawOrderSummaryItem): NormalizedOrder {
    const orderId = String(item.order_id || "");
    const orderStatus = String(item.order_status || "UNKNOWN");
    const orderAmount = this.normalizeMoney(item.order_amount);

    let rawProducts: RawAeopOrderItem[] = [];
    if (Array.isArray(item.product_list)) {
      rawProducts = item.product_list;
    } else if (item.product_list?.order_product_dto) {
      rawProducts = Array.isArray(item.product_list.order_product_dto)
        ? item.product_list.order_product_dto
        : [item.product_list.order_product_dto];
    } else if (Array.isArray(item.child_order_list)) {
      rawProducts = item.child_order_list;
    } else if (item.child_order_list?.aeop_child_order_info) {
      rawProducts = Array.isArray(item.child_order_list.aeop_child_order_info)
        ? item.child_order_list.aeop_child_order_info
        : [item.child_order_list.aeop_child_order_info];
    }

    const items: NormalizedOrderItem[] = rawProducts.map((p) =>
      this.normalizeOrderItem(p)
    );

    return {
      orderId,
      orderStatus,
      createdAt: this.toIsoString(item.gmt_create),
      modifiedAt: this.toIsoString(item.gmt_modified),
      orderAmount,
      items,
      storeInfo: item.store_info
        ? {
            storeId: item.store_info.store_id
              ? String(item.store_info.store_id)
              : undefined,
            storeName: item.store_info.store_name || undefined,
          }
        : undefined,
    };
  }

  private normalizeOrderItem(item: RawAeopOrderItem): NormalizedOrderItem {
    const childOrderId = String(item.child_order_id || item.order_id || "");
    const productId = String(item.product_id || "");
    const productName = item.product_name || "Unknown Product";
    const quantity = Number(item.product_count) || 1;

    const unitPrice = this.normalizeMoney(item.product_unit_price);
    const totalPrice = this.normalizeMoney(item.product_price);

    return {
      childOrderId,
      productId,
      productName,
      productUrl: productId ? `https://www.aliexpress.com/item/${productId}.html` : undefined,
      productSnapshotUrl: item.product_snap_url || undefined,
      productImageUrl: item.product_img_url || undefined,
      skuCode: item.sku_code || undefined,
      skuAttr: item.sku_attr || undefined,
      quantity,
      unitPrice,
      totalPrice,
      status: item.order_status || undefined,
      trackingNumber: item.tracking_no || undefined,
      logisticsServiceName: item.logistics_service_name || undefined,
    };
  }

  private normalizeAddress(
    info?: RawAeopOrderReceiverInfo
  ): NormalizedShippingAddress | undefined {
    if (!info) return undefined;
    return {
      receiverName: info.receiver_name || undefined,
      countryCode: info.country_code || undefined,
      province: info.province || undefined,
      city: info.city || undefined,
      addressDetail: info.address_detail || undefined,
      zipCode: info.zip || undefined,
      phone: info.mobile_no || info.phone || undefined,
    };
  }

  private normalizeMoney(moneyObj?: {
    amount?: string | number;
    currency_code?: string;
  }): NormalizedMoney | undefined {
    if (!moneyObj || moneyObj.amount === undefined || moneyObj.amount === null) {
      return undefined;
    }

    const amount = Number(moneyObj.amount);
    if (isNaN(amount)) return undefined;

    return {
      amount,
      currency: moneyObj.currency_code || "USD",
    };
  }

  private toIsoString(dateStr?: string): string | undefined {
    if (!dateStr) return undefined;
    try {
      const d = new Date(dateStr.replace(" ", "T"));
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
    } catch {
      // Return raw string if parsing fails
    }
    return dateStr;
  }
}
