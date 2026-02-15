# Core AWS Setup Guide (Amplify + API Gateway + Lambda + DynamoDB)

This is the **focused** deployment guide based on your current scope and your existing DynamoDB table: **`Product`**.

## Current readiness (honest status)

- ✅ Frontend build is ready for Amplify hosting.
- ✅ You already have a DynamoDB table (`Product`) with product records.
- ⚠️ Frontend still uses local mock logic for dashboard flows; backend API integration is the next step after APIs are live.

---

## 1) Confirm DynamoDB `Product` table

You already shared an item with fields like:
- `product_id` (PK)
- `product_name`
- `category`
- `description`
- `image_url`
- `price`
- `sales_count`
- `popularity_score`
- `vendor_id`

Make sure `product_id` is the partition key (String).

---

## 2) Create Lambda function for Product CRUD

1. AWS Console → Lambda → Create function
2. Name: `product-api-handler`
3. Runtime: **Node.js 20.x**
4. Execution role: create/use role with permissions:
   - `dynamodb:GetItem`
   - `dynamodb:PutItem`
   - `dynamodb:UpdateItem`
   - `dynamodb:DeleteItem`
   - `dynamodb:Scan`
   - CloudWatch logs permissions

5. In Lambda configuration, add env var:
   - `PRODUCT_TABLE=Product`

6. Paste code from:
   - `backend/lambda/product-api-handler.mjs`

7. Set handler to:
   - `product-api-handler.handler` (if file name is `product-api-handler.mjs`)

8. Deploy and test once with a simple event.

---

## 3) Create API Gateway REST API

1. API Gateway → Create API → **REST API**
2. API name: `product-service-api`
3. Create resources + methods:

### Resource `/products`
- `GET` → Lambda proxy integration → `product-api-handler`
- `POST` → Lambda proxy integration → `product-api-handler`

### Resource `/products/{product_id}`
- `GET` → Lambda proxy integration → `product-api-handler`
- `PUT` → Lambda proxy integration → `product-api-handler`
- `DELETE` → Lambda proxy integration → `product-api-handler`

4. Enable CORS on `/products` and `/products/{product_id}`
5. Deploy API to stage `prod`
6. Note your base URL:
   - `https://<api-id>.execute-api.<region>.amazonaws.com/prod`

---

## 4) Test APIs quickly (before frontend wiring)

Replace `<BASE_URL>` with your deployed URL.

### List products
```bash
curl "<BASE_URL>/products"
```

### Get one product
```bash
curl "<BASE_URL>/products/PROD005"
```

### Create product
```bash
curl -X POST "<BASE_URL>/products" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id":"PROD900",
    "product_name":"Gaming Mouse",
    "category":"Electronics",
    "description":"RGB wired gaming mouse",
    "image_url":"https://example.com/mouse.jpg",
    "price":29.99,
    "sales_count":0,
    "popularity_score":0,
    "vendor_id":"VENDOR003"
  }'
```

---

## 5) Host React frontend on Amplify

1. Push repo to GitHub/GitLab/Bitbucket
2. AWS Amplify → New app → Host web app
3. Connect repository and branch
4. Amplify will use existing `amplify.yml`
5. Add environment variable:
   - `VITE_API_BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod`
6. Deploy

---

## 6) Final integration step (required)

Your UI currently reads/writes from local in-memory service.

To complete production flow, update frontend service layer to call:
- `GET /products`
- `GET /products/{product_id}`
- `POST /products`
- `PUT /products/{product_id}`
- `DELETE /products/{product_id}`

If you want, I can implement this API integration in your React code next so it’s directly deployable.
