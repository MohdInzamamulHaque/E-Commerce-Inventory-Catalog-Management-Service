# E‑Commerce Inventory & Catalog Management (Vendor Dashboard Frontend)

This project is a React + Vite frontend for a **multi-vendor inventory and catalog management service**.

It provides a vendor dashboard to:

- View current stock levels and catalog entries
- Manage SKU variants
- Add products and update catalog details
- Increase/decrease stock manually
- Simulate order events (order placed / cancelled / refunded)
- Track stock transaction history
- View low-stock indicators and alert feed
- Configure vendor notification channels (email/SMS demo)

---

## Tech Stack

- React (functional components + hooks)
- Vite
- Plain CSS modules at app level (`App.css`, `index.css`)
- In-memory service layer for mock inventory APIs/business logic

---

## Project Structure

```text
src/
  App.jsx                           # Dashboard UI and user actions
  App.css                           # Dashboard styling
  index.css                         # Global styling reset/theme
  hooks/useOrderEventSimulator.js   # Hook to apply order event stock changes
  services/inventoryService.js      # Mock inventory/catalog logic + sample data
docs/
  architecture-diagram.md           # Architecture view (frontend + AWS backend target)
  dynamodb-schema-and-indexes.md    # DynamoDB data model and GSI design
  sample-dataset.json               # Sample multi-vendor dataset
```

---

## Run Locally

```bash
npm install
npm run dev
```

Open: `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

---

## How This Maps to the Requested Scope

This frontend implementation covers the **Vendor Dashboard Interface** and simulates key flows expected from backend integration:

- Catalog CRUD-facing actions (create/update on UI)
- Stock adjustment actions
- Low-stock detection and alert feed generation
- Order event integration behavior (stock decrement/restore)
- Stock transaction logging

Supporting backend deliverables (schema/index design, architecture, sample dataset) are documented in `docs/`.

---

## AWS Hosting Readiness Status

### Frontend (current status)
- ✅ **Ready** for hosting as a static React app (AWS Amplify/S3+CloudFront)

### Backend (current status)
- ⚠️ **Not yet implemented in this repository** as real AWS runtime code for API Gateway → Lambda → DynamoDB.
- Current dashboard business logic is mock/in-memory in:
  - `src/services/inventoryService.js`

To go production-ready, implement real Lambda APIs and switch frontend data calls from local service to HTTP API calls.

See: `docs/aws-hosting-guide.md` for exact setup steps.
