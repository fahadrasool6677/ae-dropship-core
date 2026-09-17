/**
 * AliExpress Purchased Orders TypeScript Definitions
 */

// ============================================================================
// Raw API Response Types (AliExpress Open Platform)
// ============================================================================

export interface RawAeopOrderItem {
  child_order_id?: number | string;
  order_id?: number | string;
  product_id?: number | string;
  product_name?: string;
  product_count?: number;
  product_price?: {
    amount?: string | number;
    currency_code?: string;
  };
  product_unit_price?: {
    amount?: string | number;
    currency_code?: string;
  };
  product_img_url?: string;
  product_snap_url?: string;
  sku_code?: string;
  sku_attr?: string;
  order_status?: string;
  logistics_type?: string;
  logistics_service_name?: string;
  tracking_no?: string;
  [key: string]: unknown;
}

export interface RawAeopOrderLogisticsInfo {
  logistics_no?: string;
  logistics_service?: string;
  recv_status?: string;
  gmt_send?: string;
  tracking_no?: string;
  [key: string]: unknown;
}

export interface RawAeopOrderReceiverInfo {
  receiver_name?: string;
  country_code?: string;
  province?: string;
  city?: string;
  address_detail?: string;
  zip?: string;
  phone?: string;
  mobile_no?: string;
  [key: string]: unknown;
}

export interface RawAeopOrderDetailResult {
  order_id?: number | string;
  order_status?: string;
  gmt_create?: string;
  gmt_modified?: string;
  gmt_pay_time?: string;
  gmt_send_goods_time?: string;
  order_amount?: {
    amount?: string | number;
    currency_code?: string;
  };
  init_order_amt?: {
    amount?: string | number;
    currency_code?: string;
  };
  logistics_amount?: {
    amount?: string | number;
    currency_code?: string;
  };
  seller_signer_fullname?: string;
  store_info?: {
    store_id?: number | string;
    store_name?: string;
    store_url?: string;
  };
  child_order_list?: {
    aeop_child_order_info?: RawAeopOrderItem[];
  } | RawAeopOrderItem[];
  logistics_info_list?: {
    aeop_order_logistics_info?: RawAeopOrderLogisticsInfo[];
  } | RawAeopOrderLogisticsInfo[];
  receipt_address?: RawAeopOrderReceiverInfo;
  [key: string]: unknown;
}

export interface RawAliExpressOrderDetailResponse {
  result?: RawAeopOrderDetailResult;
  aliexpress_trade_ds_order_get_response?: {
    result?: RawAeopOrderDetailResult;
    rsp_code?: number | string;
    rsp_msg?: string;
  };
  aliexpress_solution_order_info_get_response?: {
    result?: RawAeopOrderDetailResult;
    rsp_code?: number | string;
    rsp_msg?: string;
  };
  rsp_code?: number | string;
  rsp_msg?: string;
  request_id?: string;
  [key: string]: unknown;
}

export interface RawOrderSummaryItem {
  order_id?: number | string;
  order_status?: string;
  gmt_create?: string;
  gmt_modified?: string;
  order_amount?: {
    amount?: string | number;
    currency_code?: string;
  };
  product_list?: {
    order_product_dto?: RawAeopOrderItem[];
  } | RawAeopOrderItem[];
  child_order_list?: {
    aeop_child_order_info?: RawAeopOrderItem[];
  } | RawAeopOrderItem[];
  logistics_status?: string;
  store_info?: {
    store_id?: number | string;
    store_name?: string;
  };
  [key: string]: unknown;
}

export interface RawAliExpressOrderListResponse {
  result?: {
    target_list?: {
      aeop_order_dto?: RawOrderSummaryItem[];
    } | RawOrderSummaryItem[];
    order_list?: {
      order_dto?: RawOrderSummaryItem[];
    } | RawOrderSummaryItem[];
    total_count?: number;
    current_page?: number;
    page_size?: number;
    total_page?: number;
    [key: string]: unknown;
  };
  aliexpress_solution_order_get_response?: {
    result?: {
      target_list?: {
        aeop_order_dto?: RawOrderSummaryItem[];
      } | RawOrderSummaryItem[];
      order_list?: {
        order_dto?: RawOrderSummaryItem[];
      } | RawOrderSummaryItem[];
      total_count?: number;
      current_page?: number;
      page_size?: number;
      total_page?: number;
    };
    rsp_code?: number | string;
    rsp_msg?: string;
  };
  aliexpress_trade_seller_orderlist_get_response?: {
    result?: {
      order_list?: {
        order_dto?: RawOrderSummaryItem[];
      } | RawOrderSummaryItem[];
      total_count?: number;
      current_page?: number;
      page_size?: number;
      total_page?: number;
    };
    rsp_code?: number | string;
    rsp_msg?: string;
  };
  rsp_code?: number | string;
  rsp_msg?: string;
  request_id?: string;
  [key: string]: unknown;
}

// ============================================================================
// Clean Domain / Normalized Models
// ============================================================================

export interface NormalizedMoney {
  amount: number;
  currency: string;
}

export interface NormalizedOrderItem {
  childOrderId: string;
  productId: string;
  productName: string;
  productUrl?: string;
  productSnapshotUrl?: string;
  productImageUrl?: string;
  skuCode?: string;
  skuAttr?: string;
  quantity: number;
  unitPrice?: NormalizedMoney;
  totalPrice?: NormalizedMoney;
  status?: string;
  trackingNumber?: string;
  logisticsServiceName?: string;
}

export interface NormalizedShippingAddress {
  receiverName?: string;
  countryCode?: string;
  province?: string;
  city?: string;
  addressDetail?: string;
  zipCode?: string;
  phone?: string;
}

export interface NormalizedLogisticsInfo {
  trackingNumber?: string;
  logisticsServiceName?: string;
  status?: string;
  dispatchedAt?: string;
}

export interface NormalizedStoreInfo {
  storeId?: string;
  storeName?: string;
  storeUrl?: string;
}

export interface NormalizedOrder {
  orderId: string;
  orderStatus: string;
  createdAt?: string; // ISO 8601 string
  modifiedAt?: string; // ISO 8601 string
  paidAt?: string;
  shippedAt?: string;
  orderAmount?: NormalizedMoney;
  logisticsAmount?: NormalizedMoney;
  storeInfo?: NormalizedStoreInfo;
  shippingAddress?: NormalizedShippingAddress;
  logistics?: NormalizedLogisticsInfo[];
  items: NormalizedOrderItem[];
  raw?: unknown;
}

export interface OrderPaginationMetadata {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface PaginatedOrdersResult {
  orders: NormalizedOrder[];
  pagination: OrderPaginationMetadata;
  raw?: unknown;
}

export interface AllOrdersResult {
  orders: NormalizedOrder[];
  totalOrders: number;
  pagesFetched: number;
  startDate: string;
  endDate: string;
}

// ============================================================================
// Service / API Request Parameter Interfaces
// ============================================================================

export interface OrderQueryDateRangeParams {
  startDate: string | Date;
  endDate: string | Date;
  page?: number;
  pageSize?: number;
  orderStatus?: string;
  fetchAll?: boolean;
  raw?: boolean;
}

export interface OrderGetByIdParams {
  orderId: string | number;
  raw?: boolean;
}
