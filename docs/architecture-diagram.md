# Architecture Diagram (Textual)

```text
┌─────────────────────────────┐
│ Vendor (Web Browser)        │
└──────────────┬──────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────┐
│ AWS Amplify Hosting         │
│ - React Vendor Dashboard    │
└──────────────┬──────────────┘
               │ Auth (JWT)
               ▼
┌─────────────────────────────┐
│ Amazon Cognito              │
│ - Vendor user pool          │
│ - Sign-in / token issuance  │
└──────────────┬──────────────┘
               │ Bearer token
               ▼
┌─────────────────────────────┐
│ Amazon API Gateway          │
│ /products                   │
│ /inventory                  │
│ /transactions               │
└──────────────┬──────────────┘
               │ invokes
               ▼
┌───────────────────────────────────────────────────────────┐
│ AWS Lambda Functions                                     │
│ - Product CRUD                                           │
│ - Vendor inventory update                                │
│ - Order event processor (placed / cancelled / refunded)  │
│ - Low-stock checker                                      │
└──────────────┬──────────────────────────────┬─────────────┘
               │                              │
      reads/writes                     publishes low-stock
               ▼                              ▼
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ Amazon DynamoDB             │     │ Amazon SNS                  │
│ - Products                  │     │ - Email/SMS notifications   │
│ - VendorInventory           │     └─────────────────────────────┘
│ - StockTransactions         │
└──────────────┬──────────────┘
               │ logs/metrics
               ▼
┌─────────────────────────────┐
│ Amazon CloudWatch           │
│ - API errors                │
│ - Lambda failures           │
│ - Stock update failures     │
└─────────────────────────────┘
```

## Notes

- Frontend is hosted on Amplify and authenticates vendors through Cognito.
- API Gateway secures endpoints with Cognito authorizer.
- Lambda updates inventory atomically for order and stock operations.
- SNS notifies vendors when `current_stock < reorder_threshold`.
- CloudWatch captures operational visibility across API and Lambda.
