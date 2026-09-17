import { Router } from "express";
import { createAuthRouter } from "./auth.routes.js";
import { createProductRouter } from "./product.routes.js";

export function createApiRouter(): Router {
  const router = Router();

  // Sub-routers
  router.use("/aliexpress/auth", createAuthRouter());
  router.use("/aliexpress/items", createProductRouter());

  // Health and info check
  router.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "AliExpress Dropshipping Order POC",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
