# AWS Deployment Guide (API Gateway → Lambda → DynamoDB)

This guide helps you deploy the project on AWS using your IAM admin user account.

> Security note: do **not** share your IAM username/password in chat, code, screenshots, or commits.

---

## 0) Readiness Check (Current Project)

### What is ready now
- Frontend React app is production-build ready (`npm run build` succeeds).
- Data model and architecture docs exist:
  - `docs/dynamodb-schema-and-indexes.md`
  - `docs/architecture-diagram.md`

### What is not ready yet for full AWS backend hosting
- Current app uses local in-memory mock service (`src/services/inventoryService.js`).
- No deployed Lambda code, API Gateway endpoints, or DynamoDB integrations yet.

So: **Frontend hosting is ready; API backend stack needs implementation/deployment.**

---

## 1) Target Architecture

1. React frontend on **AWS Amplify Hosting**
2. REST APIs on **API Gateway**
3. Business logic in **Lambda**
4. Data in **DynamoDB**
5. Alerts with **SNS**
6. Auth via **Cognito**
7. Monitoring via **CloudWatch**

---

## 2) AWS Console Setup Steps

## Step A — Create DynamoDB tables

Create these tables (On-Demand capacity recommended initially):

1. `Products`
   - PK: `product_id` (String)
   - GSI: `vendor_id` + `last_updated`

2. `VendorInventory`
   - PK: `vendor_id` (String)
   - SK: `sku` (String)
   - GSI: `product_id` + `sku`
   - GSI: `vendor_id` + `current_stock` (low-stock query path)

3. `StockTransactions`
   - PK: `vendor_id` (String)
   - SK: `transaction_ts` (String)
   - GSI: `sku` + `transaction_ts`

Use `docs/sample-dataset.json` to seed starter records.

---

## Step B — Create SNS topic for low-stock alerts

1. SNS → Topics → Create topic (Standard)
2. Name: `low-stock-alerts`
3. Add subscriptions for email and/or SMS
4. Save topic ARN (used in Lambda env var)

---

## Step C — Create Lambda functions

Create Lambdas (Node.js 20 recommended):

1. `inventory-products-handler`
   - CRUD for products/catalog
2. `inventory-stock-handler`
   - increase/decrease stock
   - low-stock check + SNS publish
3. `inventory-order-event-handler`
   - process `order_placed`, `order_cancelled`, `order_refunded`
4. `inventory-transactions-handler`
   - stock transaction history APIs

Set environment variables in each Lambda:
- `PRODUCTS_TABLE`
- `INVENTORY_TABLE`
- `TRANSACTIONS_TABLE`
- `LOW_STOCK_SNS_TOPIC_ARN`

Attach IAM policy allowing:
- `dynamodb:GetItem/PutItem/UpdateItem/Query/Scan`
- `sns:Publish`
- CloudWatch logs permissions

---

## Step D — Create API Gateway REST API

Create resources and methods:

- `GET /products`
- `POST /products`
- `PUT /products/{product_id}`
- `DELETE /products/{product_id}`

- `GET /inventory?vendor_id=...`
- `PATCH /inventory/{sku}` (increase/decrease)
- `GET /inventory/low-stock?vendor_id=...`

- `POST /events/order` (placed/cancelled/refunded)
- `GET /transactions?vendor_id=...`

Integrate each method with corresponding Lambda.

Enable CORS for frontend domain.

Deploy stage: `prod`.

---

## Step E — Create Cognito auth

1. Cognito → User Pools → Create pool (vendors)
2. Create app client
3. Add test vendor users
4. API Gateway authorizer: Cognito user pool authorizer
5. Protect API methods requiring vendor auth

---

## Step F — Host frontend on Amplify

1. Push code to GitHub/GitLab/Bitbucket
2. Amplify → New app → Host web app → connect repo
3. Build settings (Vite):
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add frontend env var:
   - `VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod`
5. Deploy

---

## Step G — Frontend code changes required before final production go-live

Replace in-memory service usage with real API calls:

- Current: `src/services/inventoryService.js` (local state)
- Needed: `src/services/apiClient.js` with `fetch`/`axios` to API Gateway

At minimum, move these flows to backend endpoints:
- product create/update/list
- stock adjust
- low-stock fetch
- transactions fetch
- order event submit

---

## Step H — Monitoring checklist

1. CloudWatch logs enabled for all Lambdas
2. API Gateway execution/access logs enabled
3. Create alarms for:
   - Lambda Errors > threshold
   - API 5XX count > threshold
   - custom metric for stock update failure

---

## 3) Quick Go/No-Go Verdict for Your Current Repo

- **Frontend static hosting**: ✅ Go
- **Full API Gateway → Lambda → DynamoDB hosting**: ⚠️ Not yet; backend implementation + frontend API integration pending

If you want, next I can implement the backend-ready frontend integration layer (`apiClient.js`) and replace the current mock service calls so you can deploy directly after creating AWS resources.
