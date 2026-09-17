import { Request, Response, NextFunction } from "express";
import { AliExpressProductService } from "../services/aliexpress-product.service.js";

export class ProductController {
  private productService: AliExpressProductService;

  constructor(productService?: AliExpressProductService) {
    this.productService = productService || new AliExpressProductService();
  }

  /**
   * GET /api/aliexpress/items/:id
   * Retrieves product details from AliExpress by item ID.
   *
   * Query parameters:
   * - shipToCountry: ISO country code (e.g. US, GB, ES, FR)
   * - currency: Currency code (e.g. USD, EUR, GBP)
   * - language: Language code (e.g. EN, ES, FR, DE)
   * - raw: If 'true', returns the raw un-normalized AliExpress API response
   */
  public getProductById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const rawId = req.params.id;
      const productId = Array.isArray(rawId) ? rawId[0] : String(rawId || "");
      const shipToCountry = (req.query.shipToCountry as string) || undefined;
      const targetCurrency = (req.query.currency as string) || undefined;
      const targetLanguage = (req.query.language as string) || undefined;
      const isRaw = req.query.raw === "true";

      if (isRaw) {
        const rawData = await this.productService.getRawProductById({
          product_id: productId,
          ship_to_country: shipToCountry,
          target_currency: targetCurrency,
          target_language: targetLanguage,
        });

        res.json({
          success: true,
          data: rawData,
        });
        return;
      }

      const product = await this.productService.getProductById({
        product_id: productId,
        ship_to_country: shipToCountry,
        target_currency: targetCurrency,
        target_language: targetLanguage,
      });

      res.json({
        success: true,
        data: product,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/aliexpress/items/preview/sample
   * Serves the locally cached sample product data (1005007879054168) for preview.
   */
  public getSamplePreview = (req: Request, res: Response): void => {
    try {
      const fs = require("fs");
      const path = require("path");
      const samplePath = path.resolve(process.cwd(), "data", "sample-product-1005007879054168.json");
      if (fs.existsSync(samplePath)) {
        const content = JSON.parse(fs.readFileSync(samplePath, "utf-8"));
        res.json({
          success: true,
          data: content,
        });
        return;
      }
      res.status(404).json({ success: false, error: "Sample product data file not found." });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  };
}
