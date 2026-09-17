# AliExpress Dropshipping Integration (Get Item API & OAuth)

Production-ready TypeScript integration for AliExpress Open Platform (`AE-Dropshipper`). Implements OAuth 2.0 with automated token refresh and the **Get Item by ID API** (`aliexpress.ds.product.get`).

---

## 🚀 Quickstart (3 Steps)

### 1. Configure Environment
Create `.env` with your AliExpress Developer credentials:
```env
ALIEXPRESS_APP_KEY=your_app_key
ALIEXPRESS_APP_SECRET=your_app_secret
ALIEXPRESS_REDIRECT_URI=https://your-domain.ngrok-free.dev/api/aliexpress/auth/callback
PORT=3000
```

### 2. One-Time Authorization
Generate your authorization link and authorize your account:
```bash
# Print OAuth URL
npm run auth:url

# Open the printed link in browser, log in, and authorize.
# Copy the code from the redirect URL and run:
npm run cli exchange <AUTH_CODE>
```
> Tokens are automatically saved to `.token.json` and auto-refreshed before expiring.

### 3. Fetch Product Details
```bash
# Fetch live product by ID (e.g. 1005007879054168)
npm run get-item 1005007879054168 -- --country US --currency USD

# Preview offline cached sample data
npm run cli preview
```

---

## 📡 REST API & CLI Reference

Start the server: `npm run dev` (Runs on `http://localhost:3000`)

| Action | CLI Command | REST Endpoint |
|---|---|---|
| **Get Item by ID** | `npm run get-item <id> [--country US]` | `GET /api/aliexpress/items/:id?shipToCountry=US&currency=USD` |
| **Offline Sample Preview** | `npm run cli preview` | `GET /api/aliexpress/items/preview/sample` |
| **Generate OAuth Link** | `npm run auth:url` | `GET /api/aliexpress/auth/url` |
| **Exchange Auth Code** | `npm run cli exchange <code>` | `GET /api/aliexpress/auth/callback?code=...` |
| **Check Token Status** | `npm run cli status` | `GET /api/aliexpress/auth/status` |
| **Manual Token Refresh** | `npm run cli refresh` | `POST /api/aliexpress/auth/refresh` |
| **Visual Dashboard** | — | `http://localhost:3000/walkthrough` (or double-click `walkthrough.html`) |

---

## 📁 Project Structure

```
AE-order-poc/
├── src/
│   ├── config/env.ts              # Validated environment configuration
│   ├── core/
│   │   ├── signer.ts              # Official HMAC-SHA256 request signing
│   │   ├── http-client.ts         # Resilient HTTP client with error mapping
│   │   └── token-store.ts         # Persistent token store (.token.json)
│   ├── services/
│   │   ├── aliexpress-auth.service.ts    # OAuth & auto-refresh logic
│   │   └── aliexpress-product.service.ts # Product retrieval & normalization
│   ├── controllers/               # Express route handlers
│   ├── routes/                    # API route definitions
│   ├── server.ts                  # Express server entry point
│   └── cli.ts                     # Command-line utility
├── data/                          # Cached sample product responses
├── walkthrough.html               # Interactive visual walkthrough dashboard
└── tests/                         # Vitest test suite (npm test)
```

---

## 💡 Key Notes

- **Gateway URL**: Always uses the Singapore gateway (`https://api-sg.aliexpress.com`) for global applications.
- **Request Signing**: All requests are signed using `HMAC-SHA256` with parameter ASCII sorting.
- **Tests**: Run `npm test` to execute all 13 automated tests.
