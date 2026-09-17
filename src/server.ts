import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { getConfig } from "./config/env.js";
import { createApiRouter } from "./routes/index.js";
import { AliExpressApiError } from "./core/http-client.js";

import path from "path";

export function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static assets from public/
  app.use(express.static(path.resolve(process.cwd(), "public")));

  // API Routes
  app.use("/api", createApiRouter());

  // Interactive HTML Walkthrough Dashboard
  app.get("/walkthrough", (req: Request, res: Response) => {
    res.sendFile(path.resolve(process.cwd(), "walkthrough.html"));
  });

  // Root landing page (HTML in browser, JSON for API clients)
  app.get("/", (req: Request, res: Response) => {
    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      res.sendFile(path.resolve(process.cwd(), "walkthrough.html"));
      return;
    }
    res.json({
      name: "AliExpress Dropshipping Integration API",
      version: "1.0.0",
      walkthrough_dashboard: "http://localhost:3000/walkthrough",
      documentation: {
        oauth_login_url: "/api/aliexpress/auth/url",
        oauth_callback: "/api/aliexpress/auth/callback",
        token_status: "/api/aliexpress/auth/status",
        refresh_token: "POST /api/aliexpress/auth/refresh",
        get_product_by_id: "GET /api/aliexpress/items/:id",
        preview_sample: "GET /api/aliexpress/items/preview/sample",
      },
      health: "/api/health",
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global Error Handler
  app.use(
    (err: Error, req: Request, res: Response, _next: NextFunction) => {
      console.error(`[App Error] ${req.method} ${req.url} ->`, err.message);

      if (err instanceof AliExpressApiError) {
        res.status(502).json({
          success: false,
          error: err.message,
          code: err.code,
          subCode: err.subCode,
          subMsg: err.subMsg,
          requestId: err.requestId,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: err.message || "Internal Server Error",
      });
    }
  );

  return app;
}

// Start server if executed directly
if (process.env.NODE_ENV !== "test") {
  const config = getConfig();
  const app = createApp();

  app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 AliExpress Dropshipping Server listening on port ${config.port}`);
    console.log(`   - Base URL: http://localhost:${config.port}`);
    console.log(`   - Auth URL Endpoint: http://localhost:${config.port}/api/aliexpress/auth/url`);
    console.log(`   - Get Item Example: http://localhost:${config.port}/api/aliexpress/items/1005006123456789`);
    console.log(`=======================================================`);
  });
}
