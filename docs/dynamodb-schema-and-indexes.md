# DynamoDB Schema & Index Design

This document captures the proposed DynamoDB model for the inventory/catalog backend service.

## 1) Table: `Products`

Stores base catalog metadata.

- **PK**: `product_id` (String)
- **Attributes**:
  - `vendor_id` (String)
  - `name` (String)
  - `category` (String)
  - `description` (String)
  - `status` (String: `active|inactive|archived`)
  - `reorder_threshold` (Number)
  - `last_updated` (String, ISO timestamp)

### GSI
- **GSI1: vendor-product-lookup**
  - Partition key: `vendor_id`
  - Sort key: `last_updated`
  - Purpose: vendor dashboard catalog listing

---

## 2) Table: `VendorInventory`

Stores inventory and SKU-level stock.

- **PK**: `vendor_id` (String)
- **SK**: `sku` (String)
- **Attributes**:
  - `product_id` (String)
  - `current_stock` (Number)
  - `reorder_threshold` (Number)
  - `variant_label` (String)
  - `price` (Number)
  - `last_updated` (String, ISO timestamp)

### GSIs

- **GSI1: product-sku-lookup**
  - Partition key: `product_id`
  - Sort key: `sku`
  - Purpose: fetch all SKU variants for a product

- **GSI2: low-stock-by-vendor**
  - Partition key: `vendor_id`
  - Sort key: `current_stock`
  - Purpose: list low stock records quickly (app applies `current_stock <= reorder_threshold` filter)

---

## 3) Table: `StockTransactions`

Immutable transaction log for stock movements.

- **PK**: `vendor_id` (String)
- **SK**: `transaction_ts` (String, ISO timestamp)
- **Attributes**:
  - `transaction_id` (String)
  - `product_id` (String)
  - `sku` (String)
  - `event_type` (String: `stock_adjustment|order_placed|order_cancelled|order_refunded|catalog_updated`)
  - `quantity_delta` (Number)
  - `previous_stock` (Number)
  - `new_stock` (Number)
  - `reason` (String)
  - `actor` (String: `vendor|system`)

### GSI
- **GSI1: sku-history**
  - Partition key: `sku`
  - Sort key: `transaction_ts`
  - Purpose: SKU-level audit trail

---

## Core Required Fields Mapping

The required fields from the scope are represented as:

- `product_id` → `Products.product_id`, `VendorInventory.product_id`
- `vendor_id` → all tables as partition key or attribute
- `sku` → `VendorInventory.sku`, `StockTransactions.sku`
- `current_stock` → `VendorInventory.current_stock`
- `reorder_threshold` → `Products.reorder_threshold`, `VendorInventory.reorder_threshold`
- `last_updated` → `Products.last_updated`, `VendorInventory.last_updated`
