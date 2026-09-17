import { Router } from "express";
import { OrderController } from "../controllers/order.controller.js";

export function createOrderRouter(controller?: OrderController): Router {
  const router = Router();
  const orderCtrl = controller || new OrderController();

  router.get("/", orderCtrl.getOrders);
  router.get("/:orderId", orderCtrl.getOrderById);

  return router;
}
