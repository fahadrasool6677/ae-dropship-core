import { Router } from "express";
import { ProductController } from "../controllers/product.controller.js";

export function createProductRouter(controller?: ProductController): Router {
  const router = Router();
  const productCtrl = controller || new ProductController();

  router.get("/preview/sample", productCtrl.getSamplePreview);
  router.get("/:id", productCtrl.getProductById);

  return router;
}
