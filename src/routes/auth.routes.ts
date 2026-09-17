import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";

export function createAuthRouter(controller?: AuthController): Router {
  const router = Router();
  const authCtrl = controller || new AuthController();

  router.get("/url", authCtrl.getAuthUrl);
  router.get("/callback", authCtrl.handleCallback);
  router.post("/refresh", authCtrl.refreshToken);
  router.get("/status", authCtrl.getStatus);

  return router;
}
