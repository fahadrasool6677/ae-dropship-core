import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrderController } from "../src/controllers/order.controller.js";
import { AliExpressOrderService } from "../src/services/aliexpress-order.service.js";
import { Request, Response } from "express";

describe("OrderController", () => {
  let mockOrderService: AliExpressOrderService;
  let controller: OrderController;

  beforeEach(() => {
    mockOrderService = new AliExpressOrderService();
    controller = new OrderController(mockOrderService);
  });

  function createMockResponse(): {
    res: Partial<Response>;
    statusCode: number;
    jsonBody: any;
  } {
    const tracker = {
      statusCode: 200,
      jsonBody: null as any,
      res: {} as Partial<Response>,
    };

    tracker.res = {
      status: vi.fn().mockImplementation((code: number) => {
        tracker.statusCode = code;
        return tracker.res;
      }),
      json: vi.fn().mockImplementation((body: any) => {
        tracker.jsonBody = body;
        return tracker.res;
      }),
    };

    return tracker;
  }

  describe("GET /api/aliexpress/orders", () => {
    it("should return 400 when startDate or endDate are missing", async () => {
      const { res } = createMockResponse();
      const req = {
        query: { startDate: "2026-09-01" },
      } as unknown as Request;

      await controller.getOrders(req, res as Response, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("startDate' and 'endDate' are required"),
        })
      );
    });

    it("should return paginated orders when valid date range is provided", async () => {
      const { res } = createMockResponse();
      const req = {
        query: {
          startDate: "2026-09-01",
          endDate: "2026-09-18",
          page: "1",
          pageSize: "20",
        },
      } as unknown as Request;

      vi.spyOn(mockOrderService, "getOrdersByDateRange").mockResolvedValue({
        orders: [
          {
            orderId: "123456",
            orderStatus: "FINISH",
            items: [],
          },
        ],
        pagination: {
          currentPage: 1,
          pageSize: 20,
          totalCount: 1,
          totalPages: 1,
          hasNextPage: false,
        },
      });

      await controller.getOrders(req, res as Response, vi.fn());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            orders: expect.arrayContaining([
              expect.objectContaining({ orderId: "123456" }),
            ]),
          }),
        })
      );
    });

    it("should call getAllOrdersByDateRange when fetchAll=true is passed", async () => {
      const { res } = createMockResponse();
      const req = {
        query: {
          startDate: "2026-09-01",
          endDate: "2026-09-18",
          fetchAll: "true",
        },
      } as unknown as Request;

      vi.spyOn(mockOrderService, "getAllOrdersByDateRange").mockResolvedValue({
        orders: [
          { orderId: "9001", orderStatus: "FINISH", items: [] },
          { orderId: "9002", orderStatus: "FINISH", items: [] },
        ],
        totalOrders: 2,
        pagesFetched: 1,
        startDate: "2026-09-01 00:00:00",
        endDate: "2026-09-18 23:59:59",
      });

      await controller.getOrders(req, res as Response, vi.fn());

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            orders: expect.any(Array),
            totalOrders: 2,
          }),
        })
      );
    });
  });

  describe("GET /api/aliexpress/orders/:orderId", () => {
    it("should return 400 when orderId is non-numeric", async () => {
      const { res } = createMockResponse();
      const req = {
        params: { orderId: "invalid-id" },
        query: {},
      } as unknown as Request;

      await controller.getOrderById(req, res as Response, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Order ID must be numeric"),
        })
      );
    });

    it("should return normalized order on valid orderId", async () => {
      const { res } = createMockResponse();
      const req = {
        params: { orderId: "100200300" },
        query: {},
      } as unknown as Request;

      vi.spyOn(mockOrderService, "getOrderById").mockResolvedValue({
        orderId: "100200300",
        orderStatus: "WAIT_SELLER_SEND_GOODS",
        items: [],
      });

      await controller.getOrderById(req, res as Response, vi.fn());

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          orderId: "100200300",
          orderStatus: "WAIT_SELLER_SEND_GOODS",
        }),
      });
    });
  });
});
