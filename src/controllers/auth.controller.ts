import { Request, Response, NextFunction } from "express";
import { AliExpressAuthService } from "../services/aliexpress-auth.service.js";

export class AuthController {
  private authService: AliExpressAuthService;

  constructor(authService?: AliExpressAuthService) {
    this.authService = authService || new AliExpressAuthService();
  }

  /**
   * GET /api/aliexpress/auth/url
   * Returns the OAuth 2.0 authorization URL for the user to log in and grant permissions.
   */
  public getAuthUrl = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const state = (req.query.state as string) || "ae_dropship_session";
      const url = this.authService.getAuthorizationUrl(state);

      res.json({
        success: true,
        message: "Open this URL in your browser to complete AliExpress authorization.",
        url,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/aliexpress/auth/callback
   * OAuth redirect handler that captures the authorization code and exchanges it for tokens.
   */
  public handleCallback = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const code = req.query.code as string;
      const error = req.query.error as string;
      const errorDescription = req.query.error_description as string;

      if (error) {
        res.status(400).json({
          success: false,
          error: `AliExpress authorization rejected: ${error} - ${errorDescription || "No details"}`,
        });
        return;
      }

      if (!code) {
        res.status(400).json({
          success: false,
          error: "Missing authorization 'code' parameter in callback request.",
        });
        return;
      }

      const stored = await this.authService.exchangeCodeForToken(code);

      // Return a friendly HTML response if the user visited via a browser
      const acceptsHtml = req.headers.accept && req.headers.accept.includes("text/html");
      if (acceptsHtml) {
        res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>AliExpress Authorization Successful</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; line-height: 1.6; }
                .card { background: #f9fbfd; border: 1px solid #d2e3fc; border-radius: 8px; padding: 24px; }
                h1 { color: #1a73e8; margin-top: 0; }
                .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #e6f4ea; color: #137333; font-weight: bold; }
                code { background: #f1f3f4; padding: 2px 6px; border-radius: 4px; }
              </style>
            </head>
            <body>
              <div class="card">
                <span class="badge">Success</span>
                <h1>AliExpress Connected!</h1>
                <p>Your application is now authorized to query products and orders.</p>
                <p><strong>Account:</strong> ${stored.userNick || stored.userId || "Authorized Account"}</p>
                <p><strong>Tokens saved:</strong> Stored securely in <code>.token.json</code>.</p>
                <p>You can close this window and run your Get Item requests!</p>
              </div>
            </body>
          </html>
        `);
        return;
      }

      res.json({
        success: true,
        message: "AliExpress authorization completed successfully. Tokens stored.",
        userNick: stored.userNick,
        userId: stored.userId,
        expiresAt: stored.expiresAt ? new Date(stored.expiresAt).toISOString() : undefined,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/aliexpress/auth/refresh
   * Manually triggers a token refresh using the stored or supplied refresh token.
   */
  public refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const customRefreshToken = req.body?.refreshToken as string | undefined;
      const stored = await this.authService.refreshToken(customRefreshToken);

      res.json({
        success: true,
        message: "AliExpress access token refreshed successfully.",
        expiresAt: stored.expiresAt ? new Date(stored.expiresAt).toISOString() : undefined,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/aliexpress/auth/status
   * Returns current token existence, expiration, and user account metadata.
   */
  public getStatus = (req: Request, res: Response): void => {
    const status = this.authService.getTokenStatus();
    res.json({
      success: true,
      data: status,
    });
  };
}
