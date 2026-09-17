## Task: Implement AliExpress Purchased Orders APIs

I now want to extend the existing AliExpress integration in this dropshipping application.

The AliExpress account is already authenticated using the authentication flow implemented previously.

I need to implement the APIs required to retrieve **orders purchased by the authenticated AliExpress account**.

### APIs to Implement

Implement the following functionality:

1. **Get Orders by Date Range**

   * Retrieve purchased AliExpress orders for the authenticated account within a specified date/time range.
   * Support:

     * Start date/time
     * End date/time
     * Pagination
     * Page size, if supported by the API
   * Handle the API's maximum allowed date range if applicable.
   * Return normalized order data while preserving the original AliExpress response where useful.

2. **Get Order by ID**

   * Implement an API/service method to retrieve a specific purchased AliExpress order using its order ID.
   * The request must use the authenticated AliExpress account/token.
   * Properly handle invalid/non-existent order IDs.

### Implementation Requirements

First inspect the existing AliExpress integration implemented previously.

Reuse the existing:

* Authentication flow
* Access-token handling
* API client
* Request signing logic
* Configuration
* Error handling
* Logging
* TypeScript types
* Project architecture

Do **not** create a second authentication implementation if the existing one can be reused.

### API Documentation

Before implementing anything, verify the **current official AliExpress API documentation** and determine:

* Correct API names/endpoints
* Required parameters
* Authentication requirements
* Required signatures
* Date format
* Timezone requirements
* Maximum date-range limitations
* Pagination parameters
* Maximum page size
* Order ID format
* Rate limits
* Relevant error codes

Do not rely on outdated AliExpress API examples.

### Suggested Service API

Follow the existing project conventions, but the resulting service should provide functionality similar to:

```ts
getOrdersByDateRange({
  startDate,
  endDate,
  page,
  pageSize,
});

getOrderById(orderId);
```

Use proper TypeScript types rather than `any` wherever practical.

### Pagination

If the AliExpress API supports pagination:

* Implement pagination parameters.
* Provide a way to retrieve a specific page.
* If appropriate, also provide a helper that automatically retrieves all pages for a date range.
* Prevent infinite pagination loops.
* Handle API limits correctly.

### Date Handling

Be explicit about:

* Input date format
* Timezone
* Conversion to the format required by AliExpress
* Start/end boundary behavior

For example:

```text
startDate = 2026-09-01T00:00:00Z
endDate   = 2026-09-18T23:59:59Z
```

Use the format actually required by the current AliExpress API rather than assuming the above format.

### Error Handling

Handle at least:

* Invalid/expired access token
* Invalid date range
* Invalid order ID
* Rate limiting
* AliExpress API errors
* Network errors
* Empty order results
* Pagination errors

Do not expose:

* App secret
* Access token
* API credentials
* Signature secrets

in logs or API responses.

### Testing

Create executable tests/examples for:

#### 1. Get orders by date range

Example:

```text
Start: 2026-09-01
End:   2026-09-18
```

#### 2. Get order by ID

Use an order ID supplied through configuration or command-line input.

Test:

* Successful request
* Empty result
* Invalid order ID
* Authentication failure
* API error

Use real AliExpress API requests for the end-to-end example where credentials are available.

### Environment Configuration

Reuse the existing AliExpress environment configuration.

Only add new variables if the current API actually requires them.

Do not hardcode credentials or tokens.

### Executable Setup

At the end, provide exact commands that I can run from a clean environment:

```text
1. Install dependencies
2. Configure environment variables
3. Authenticate the AliExpress account
4. Start the application
5. Run Get Orders by Date Range
6. Run Get Order by ID
7. Verify the returned data
```

For example:

```bash
npm install

npm run dev

npm run aliexpress:orders -- \
  --start=2026-09-01 \
  --end=2026-09-18

npm run aliexpress:order -- \
  --order-id=<ORDER_ID>
```

Use the project's actual package manager and existing scripts instead of blindly adding these exact commands.

### Final Deliverable

After implementation, provide:

1. Files created/modified
2. Complete implementation
3. TypeScript types
4. API client/service implementation
5. Authentication reuse details
6. Pagination implementation
7. Date-range handling
8. Error handling
9. Test implementation
10. Exact commands to execute the tests
11. Example successful response
12. Example error responses
13. Troubleshooting guide
14. Any AliExpress API limitations discovered

### Important

Do not provide pseudocode or partial implementation.

Inspect the existing code first, verify the **current official AliExpress API documentation**, and then implement the feature using the project's existing architecture.

Do not modify unrelated parts of the application.
