import { Request, Response, NextFunction } from "express";
import { AliExpressOrderService } from "../services/aliexpress-order.service.js";

export class OrderController {
  private orderService: AliExpressOrderService;

  constructor(orderService?: AliExpressOrderService) {
    this.orderService = orderService || new AliExpressOrderService();
  }

  /**
   * GET /api/aliexpress/orders
   * Retrieves orders purchased by the authenticated AliExpress account within a date range.
   *
   * Query parameters:
   * - startDate: ISO string or YYYY-MM-DD (e.g. 2026-09-01) [Required]
   * - endDate: ISO string or YYYY-MM-DD (e.g. 2026-09-18) [Required]
   * - page: Page index (default: 1)
   * - pageSize: Page size, 1-50 (default: 20)
   * - status: Filter by status (e.g. WAIT_SELLER_SEND_GOODS, FINISH)
   * - fetchAll: If 'true', automatically paginates and returns all matching orders
   * - raw: If 'true', includes the un-normalized AliExpress API response
   */
  public getOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        startDate,
        endDate,
        page,
        pageSize,
        status,
        fetchAll,
        raw,
      } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: "Missing required query parameters: 'startDate' and 'endDate' are required.",
          example: "/api/aliexpress/orders?startDate=2026-09-01&endDate=2026-09-18",
        });
        return;
      }

      const isFetchAll = fetchAll === "true";
      const isRaw = raw === "true";

      if (isFetchAll) {
        const result = await this.orderService.getAllOrdersByDateRange({
          startDate: String(startDate),
          endDate: String(endDate),
          pageSize: pageSize ? Number(pageSize) : 50,
          orderStatus: status ? String(status) : undefined,
          raw: isRaw,
        });

        res.json({
          success: true,
          data: result,
        });
        return;
      }

      const paginatedResult = await this.orderService.getOrdersByDateRange({
        startDate: String(startDate),
        endDate: String(endDate),
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20,
        orderStatus: status ? String(status) : undefined,
        raw: isRaw,
      });

      res.json({
        success: true,
        data: paginatedResult,
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to retrieve orders";
      let statusCode = 500;

      if (
        msg.includes("Invalid date") ||
        msg.includes("Missing required date") ||
        msg.includes("exceeds maximum")
      ) {
        statusCode = 400;
      } else if (msg.includes("No AliExpress Access Token") || msg.includes("unauthorized")) {
        statusCode = 401;
      } else if (msg.includes("AliExpress API error")) {
        statusCode = 502;
      }

      res.status(statusCode).json({
        success: false,
        error: msg,
      });
    }
  };

  /**
   * GET /api/aliexpress/orders/:orderId
   * Retrieves full details for a specific purchased order by order ID.
   *
   * Query parameters:
   * - raw: If 'true', includes the un-normalized AliExpress API response
   */
  public getOrderById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const rawOrderId = req.params.orderId;
      const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : String(rawOrderId || "");
      const isRaw = req.query.raw === "true";

      if (!orderId || !/^\d+$/.test(orderId)) {
        res.status(400).json({
          success: false,
          error: `Invalid order ID: "${orderId}". Order ID must be numeric.`,
        });
        return;
      }

      const order = await this.orderService.getOrderById(orderId, {
        raw: isRaw,
      });

      res.json({
        success: true,
        data: order,
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to retrieve order";
      let statusCode = 500;

      if (msg.includes("Invalid AliExpress Order ID")) {
        statusCode = 400;
      } else if (msg.includes("Order not found")) {
        statusCode = 404;
      } else if (msg.includes("No AliExpress Access Token") || msg.includes("unauthorized")) {
        statusCode = 401;
      } else if (msg.includes("AliExpress API error")) {
        statusCode = 502;
      }

      res.status(statusCode).json({
        success: false,
        error: msg,
      });
    }
  };
}
