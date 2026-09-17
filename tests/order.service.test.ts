import { describe, it, expect, beforeEach, vi } from "vitest";
import { AliExpressOrderService } from "../src/services/aliexpress-order.service.js";
import { AliExpressAuthService } from "../src/services/aliexpress-auth.service.js";
import { AliExpressHttpClient } from "../src/core/http-client.js";
import {
  RawAliExpressOrderDetailResponse,
  RawAliExpressOrderListResponse,
} from "../src/types/order.types.js";

describe("AliExpressOrderService", () => {
  let mockHttpClient: AliExpressHttpClient;
  let mockAuthService: AliExpressAuthService;
  let orderService: AliExpressOrderService;

  beforeEach(() => {
    process.env.ALIEXPRESS_APP_KEY = "test_key_123";
    process.env.ALIEXPRESS_APP_SECRET = "test_secret_456";

    mockHttpClient = new AliExpressHttpClient();
    mockAuthService = new AliExpressAuthService(mockHttpClient);
    vi.spyOn(mockAuthService, "getValidAccessToken").mockResolvedValue("mock_valid_token_777");

    orderService = new AliExpressOrderService(mockHttpClient, mockAuthService);
  });

  describe("Validation & Date Handling", () => {
    it("should reject invalid, non-numeric order IDs", async () => {
      await expect(orderService.getOrderById("abc-invalid")).rejects.toThrow(
        /Invalid AliExpress Order ID/
      );
      await expect(orderService.getOrderById("")).rejects.toThrow(
        /Invalid AliExpress Order ID/
      );
      await expect(orderService.getOrderById("123-456")).rejects.toThrow(
        /Invalid AliExpress Order ID/
      );
    });

    it("should correctly format date strings into YYYY-MM-DD HH:mm:ss", () => {
      // Date-only string
      const startFormatted = orderService.formatAliExpressDateTime("2026-09-01", false);
      expect(startFormatted).toBe("2026-09-01 00:00:00");

      const endFormatted = orderService.formatAliExpressDateTime("2026-09-18", true);
      expect(endFormatted).toBe("2026-09-18 23:59:59");

      // Already formatted
      const exact = orderService.formatAliExpressDateTime("2026-09-05 14:30:00");
      expect(exact).toBe("2026-09-05 14:30:00");

      // ISO string
      const fromIso = orderService.formatAliExpressDateTime("2026-09-01T12:00:00.000Z");
      expect(fromIso).toBe("2026-09-01 12:00:00");
    });

    it("should reject invalid date range where startDate is after endDate", async () => {
      await expect(
        orderService.getOrdersByDateRange({
          startDate: "2026-09-20",
          endDate: "2026-09-10",
        })
      ).rejects.toThrow(/Start date .* must be earlier than or equal to End date/);
    });

    it("should reject date ranges that exceed the 180-day platform limit", async () => {
      await expect(
        orderService.getOrdersByDateRange({
          startDate: "2025-01-01",
          endDate: "2026-01-01",
        })
      ).rejects.toThrow(/Date range exceeds maximum allowed window of 180 days/);
    });
  });

  describe("getOrderById", () => {
    it("should successfully fetch and normalize order details", async () => {
      const mockRawResponse: RawAliExpressOrderDetailResponse = {
        aliexpress_trade_ds_order_get_response: {
          rsp_code: "200",
          result: {
            order_id: 812345678901234,
            order_status: "WAIT_SELLER_SEND_GOODS",
            gmt_create: "2026-09-10 10:15:30",
            gmt_pay_time: "2026-09-10 10:16:00",
            order_amount: {
              amount: "45.99",
              currency_code: "USD",
            },
            logistics_amount: {
              amount: "3.50",
              currency_code: "USD",
            },
            store_info: {
              store_id: 998877,
              store_name: "Official Tech Store",
              store_url: "https://www.aliexpress.com/store/998877",
            },
            receipt_address: {
              receiver_name: "Jane Doe",
              country_code: "US",
              province: "California",
              city: "San Francisco",
              address_detail: "123 Market St Apt 4B",
              zip: "94103",
              phone: "555-0199",
            },
            child_order_list: {
              aeop_child_order_info: [
                {
                  child_order_id: 812345678901235,
                  product_id: 1005007879054168,
                  product_name: "Ultra Thin Mechanical Keyboard RGB Backlit",
                  product_count: 1,
                  product_unit_price: {
                    amount: "42.49",
                    currency_code: "USD",
                  },
                  product_price: {
                    amount: "42.49",
                    currency_code: "USD",
                  },
                  sku_attr: "Color: Space Gray | Switch: Red",
                  order_status: "WAIT_SELLER_SEND_GOODS",
                },
              ],
            },
            logistics_info_list: {
              aeop_order_logistics_info: [
                {
                  logistics_service: "AliExpress Standard Shipping",
                  tracking_no: "LP001234567890",
                  recv_status: "processing",
                },
              ],
            },
          },
        },
      };

      vi.spyOn(mockHttpClient, "post").mockResolvedValue(mockRawResponse);

      const order = await orderService.getOrderById("812345678901234");

      expect(order.orderId).toBe("812345678901234");
      expect(order.orderStatus).toBe("WAIT_SELLER_SEND_GOODS");
      expect(order.orderAmount).toEqual({ amount: 45.99, currency: "USD" });
      expect(order.storeInfo?.storeName).toBe("Official Tech Store");
      expect(order.shippingAddress?.receiverName).toBe("Jane Doe");
      expect(order.shippingAddress?.city).toBe("San Francisco");

      expect(order.items).toHaveLength(1);
      expect(order.items[0].productId).toBe("1005007879054168");
      expect(order.items[0].productName).toBe("Ultra Thin Mechanical Keyboard RGB Backlit");
      expect(order.items[0].quantity).toBe(1);
      expect(order.items[0].totalPrice).toEqual({ amount: 42.49, currency: "USD" });

      expect(order.logistics).toHaveLength(1);
      expect(order.logistics?.[0].trackingNumber).toBe("LP001234567890");
      expect(order.logistics?.[0].logisticsServiceName).toBe("AliExpress Standard Shipping");
    });

    it("should handle non-existent order responses with clear error message", async () => {
      const mockEmptyResponse: RawAliExpressOrderDetailResponse = {
        aliexpress_trade_ds_order_get_response: {
          rsp_code: "200",
          rsp_msg: "Order does not exist",
          result: {} as any,
        },
      };

      vi.spyOn(mockHttpClient, "post").mockResolvedValue(mockEmptyResponse);

      await expect(orderService.getOrderById("999999999999999")).rejects.toThrow(
        /Order not found or unauthorized/
      );
    });

    it("should handle upstream AliExpress error codes", async () => {
      const mockErrorResponse: RawAliExpressOrderDetailResponse = {
        rsp_code: 404,
        rsp_msg: "Sub-account unauthorized to view this order",
      };

      vi.spyOn(mockHttpClient, "post").mockResolvedValue(mockErrorResponse);

      await expect(orderService.getOrderById("888888888888888")).rejects.toThrow(
        /AliExpress API error/
      );
    });
  });

  describe("getOrdersByDateRange", () => {
    it("should retrieve a paginated page of orders and normalize results", async () => {
      const mockRawListResponse: RawAliExpressOrderListResponse = {
        aliexpress_solution_order_get_response: {
          rsp_code: "200",
          result: {
            total_count: 2,
            current_page: 1,
            page_size: 20,
            total_page: 1,
            target_list: {
              aeop_order_dto: [
                {
                  order_id: "8001",
                  order_status: "FINISH",
                  gmt_create: "2026-09-02 11:00:00",
                  order_amount: { amount: "19.99", currency_code: "USD" },
                  product_list: {
                    order_product_dto: [
                      {
                        child_order_id: "80011",
                        product_id: "1001",
                        product_name: "Item A",
                        product_count: 2,
                      },
                    ],
                  },
                },
                {
                  order_id: "8002",
                  order_status: "WAIT_SELLER_SEND_GOODS",
                  gmt_create: "2026-09-05 14:20:00",
                  order_amount: { amount: "34.50", currency_code: "USD" },
                  product_list: {
                    order_product_dto: [
                      {
                        child_order_id: "80021",
                        product_id: "1002",
                        product_name: "Item B",
                        product_count: 1,
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      };

      vi.spyOn(mockHttpClient, "post").mockResolvedValue(mockRawListResponse);

      const result = await orderService.getOrdersByDateRange({
        startDate: "2026-09-01",
        endDate: "2026-09-18",
        page: 1,
        pageSize: 20,
      });

      expect(result.orders).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(2);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasNextPage).toBe(false);

      expect(result.orders[0].orderId).toBe("8001");
      expect(result.orders[0].orderStatus).toBe("FINISH");
      expect(result.orders[0].orderAmount).toEqual({ amount: 19.99, currency: "USD" });
      expect(result.orders[0].items[0].productName).toBe("Item A");
      expect(result.orders[0].items[0].quantity).toBe(2);

      expect(result.orders[1].orderId).toBe("8002");
      expect(result.orders[1].orderStatus).toBe("WAIT_SELLER_SEND_GOODS");
    });

    it("should return empty order list gracefully when no orders found", async () => {
      const mockEmptyListResponse: RawAliExpressOrderListResponse = {
        aliexpress_solution_order_get_response: {
          rsp_code: "200",
          result: {
            total_count: 0,
            current_page: 1,
            page_size: 20,
            total_page: 0,
            target_list: {
              aeop_order_dto: [],
            },
          },
        },
      };

      vi.spyOn(mockHttpClient, "post").mockResolvedValue(mockEmptyListResponse);

      const result = await orderService.getOrdersByDateRange({
        startDate: "2026-09-01",
        endDate: "2026-09-18",
      });

      expect(result.orders).toEqual([]);
      expect(result.pagination.totalCount).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
    });
  });

  describe("getAllOrdersByDateRange", () => {
    it("should auto-paginate across multiple pages until all orders are fetched", async () => {
      // Mock page 1
      const page1Response: RawAliExpressOrderListResponse = {
        aliexpress_solution_order_get_response: {
          result: {
            total_count: 3,
            current_page: 1,
            page_size: 2,
            total_page: 2,
            target_list: {
              aeop_order_dto: [
                { order_id: "9001", order_status: "FINISH", gmt_create: "2026-09-01 10:00:00" },
                { order_id: "9002", order_status: "FINISH", gmt_create: "2026-09-02 10:00:00" },
              ],
            },
          },
        },
      };

      // Mock page 2
      const page2Response: RawAliExpressOrderListResponse = {
        aliexpress_solution_order_get_response: {
          result: {
            total_count: 3,
            current_page: 2,
            page_size: 2,
            total_page: 2,
            target_list: {
              aeop_order_dto: [
                { order_id: "9003", order_status: "FINISH", gmt_create: "2026-09-03 10:00:00" },
              ],
            },
          },
        },
      };

      const postSpy = vi.spyOn(mockHttpClient, "post");
      postSpy.mockResolvedValueOnce(page1Response);
      postSpy.mockResolvedValueOnce(page2Response);

      const allResult = await orderService.getAllOrdersByDateRange({
        startDate: "2026-09-01",
        endDate: "2026-09-18",
        pageSize: 2,
      });

      expect(allResult.orders).toHaveLength(3);
      expect(allResult.orders.map((o) => o.orderId)).toEqual(["9001", "9002", "9003"]);
      expect(allResult.totalOrders).toBe(3);
      expect(allResult.pagesFetched).toBe(2);
    });

    it("should respect maxPages limit to prevent infinite pagination loops", async () => {
      // Repeatedly return hasNextPage = true
      const loopResponse: RawAliExpressOrderListResponse = {
        aliexpress_solution_order_get_response: {
          result: {
            total_count: 100,
            current_page: 1,
            page_size: 1,
            total_page: 100,
            target_list: {
              aeop_order_dto: [
                { order_id: "LOOP-ORDER", order_status: "FINISH" },
              ],
            },
          },
        },
      };

      vi.spyOn(mockHttpClient, "post").mockResolvedValue(loopResponse);

      const allResult = await orderService.getAllOrdersByDateRange({
        startDate: "2026-09-01",
        endDate: "2026-09-18",
        maxPages: 3, // strictly limit to 3 iterations
      });

      expect(allResult.orders.length).toBe(3);
      expect(allResult.pagesFetched).toBe(3);
    });
  });
});
