# inventory-management-bn

Backend of **inventory-management**: an Express 5 + MySQL **stock ledger** for a salon.

All products carry manufacturer barcodes (EAN/UPC) and are either **professional** (used in services) or **retail** (sold over the counter). For any period, the system answers three questions per product:

1. How many did we buy?
2. How many were used, sold or damaged, and by whom?
3. How many are left, and how many are missing?

It is not a billing system. Missing stock shows up when a periodic **stock count** compares the ledger with what is on the shelf. The difference is reported in units and ₹.

Frontend: [inventory-management-fn](https://github.com/PriyanujBora/inventory-management-fn)

## Requirements

- Node.js 18+ (developed on Node 24)
- MySQL 5.7+ or 8.x

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the database.

   > **Warning:** [config/schema.sql](config/schema.sql) **drops and recreates** `inventory_management`. It is for development only.

   ```bash
   mysql -u root -p < config/schema.sql
   mysql -u root -p < config/seed.sql      # optional demo data
   ```

   With MySQL in Docker:

   ```bash
   docker exec -i <container> mysql -uroot < config/schema.sql
   docker exec -i <container> mysql -uroot < config/seed.sql
   ```

   The seed adds:
   - 5 staff: an owner, a manager and 3 stylists.
   - 10 salon products.
   - Opening stock and a delivery.
   - About a week of usage and sales, including one undone scan.
   - A closed stock count that found 4 units missing (₹2,510).
   - 3 products at or below their reorder level.

   It is timed relative to when you run it, so every screen has data straight away.

3. Copy `.env.example` to `.env` and fill in your MySQL credentials.

4. Start the API:

   ```bash
   npm run dev     # with nodemon (restarts on file changes)
   npm start       # plain node
   ```

5. Run the ledger test:

   ```bash
   npm test
   ```

   It works on a throwaway `inventory_management_test` database, which it creates and drops itself.

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `PORT` | `5000` | Must match the frontend's `VITE_API_URL` |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Frontend origin(s) allowed by CORS, comma-separated |
| `DB_HOST` | `127.0.0.1` | Prefer `127.0.0.1` over `localhost` on Windows |
| `DB_PORT` | `3306` | |
| `DB_USER` | `root` | |
| `DB_PASSWORD` | | May be empty |
| `DB_NAME` | `inventory_management` | |
| `DB_CONNECTION_LIMIT` | `10` | Optional |

## Data model

| Table | Purpose |
|---|---|
| `staff` | People who take stock out. Deactivated, never deleted. |
| `products` | Barcode, name, category, latest unit cost, reorder level, active flag. |
| `stock_movements` | **Append-only ledger.** Rows are never updated or deleted. |
| `stock_receipts` | One row per delivery (or the opening stock-take); groups its `purchase`/`opening` rows. |
| `stock_counts`, `stock_count_lines` | Periodic physical counts and what was counted per product. |

**Stock on hand is always `SUM(qty)` over a product's movements.** It is never stored.

## Domain rules

### Movement types

The API always receives a **positive** `qty`; the server applies the sign.

| Type | Sign | Meaning | `taken_by` |
|---|---|---|---|
| `opening` | + | Stock already on shelves on go-live day | not allowed |
| `purchase` | + | Delivery received | not allowed |
| `used` | − | Opened or used in a service | required |
| `sold` | − | Sold to a customer | required |
| `damaged` | − | Broken, spilled or expired | required |
| `count_adjustment` | ± | Written only by closing a stock count | not allowed |

### Quantities and costs

- Quantities are whole units, 1–10,000 per line.
- **Opening and purchase rows:** a `unitCost` on the receipt line also becomes the product's current cost. If none is given, the current cost is snapshotted onto the row.
- **All other rows** snapshot the product's current cost.
- **Every ₹ figure comes from each row's own snapshot.** Changing a product's cost later never rewrites history.

### Negative stock

- An out-movement that would take stock below 0 is rejected with `409 INSUFFICIENT_STOCK`. The message includes the current stock.
- If the request sends `confirmNegative: true`, the row is stored anyway, with the note "Recorded with insufficient stock".

### Undo and reversal

- A reversal is a new row with the **same type**, the opposite `qty`, the same product, `taken_by` and `unit_cost`, and `reverses_id` set. Per-type report sums therefore net out by themselves.
- A row can be reversed only once (`ALREADY_REVERSED`).
- A reversal can't itself be reversed (`CANNOT_REVERSE_REVERSAL`).
- Count adjustments can't be reversed (`CANNOT_REVERSE_COUNT`). Correct them with a new count.
- Reversals skip the negative-stock check, because they correct mistakes. Reversing a purchase does not change the product's current cost.
- There are two routes:
  - `POST /movements/:id/undo`: for any operator, within **60 s** of the scan. The UI offers it for 10 s; the extra time absorbs network delay.
  - `POST /movements/:id/reverse`: owner only, at any time, with a reason.

### Products and receipts

- Only Stock In can register a product: barcode, name, category and cost are required.
- Take Out and Count answer `404 NOT_REGISTERED` for an unknown barcode, and `409 PRODUCT_INACTIVE` for a deactivated product.
- A receipt is **one transaction**: a `stock_receipts` row plus one movement per product. Lines with the same barcode are merged by summing quantities, and the last cost given wins.

### Stock counts

- Only one count can be open at a time (`409 COUNT_ALREADY_OPEN`).
- **Scanning:** each scan adds 1 to that product's `counted_qty` and is saved immediately. A line can also be set directly with `PUT …/lines/:productId`; 0 is allowed.
- **Preview:** every **active** product, with expected (ledger), counted (0 if never scanned), difference and its ₹ value. Products expected and counted at 0 are left out.
- **Closing** is one transaction:
  - It locks the count row and **every active product row**. Every stock change locks its product row first, so nothing can move stock mid-close.
  - It stores `expected_qty` on each line and writes one `count_adjustment` per product whose counted quantity differs.
  - **Missing** = negative adjustments; **surplus** = positive ones.
- **Cancelling** writes no movements.
- Moving stock during an open count is **not** blocked. The frontend warns instead.

### Locking

- Every stock change (take out, receipt, reversal, count close) locks the affected product rows before reading or writing the ledger.
- Receipts lock their products in barcode order.
- With one lock order everywhere, transactions serialise per product and can't deadlock.

### Authentication

There is no login yet: `recorded_by` and `started_by` stay `NULL`.

Owner-only routes go through `requireOwner` in [middleware/auth.middleware.js](middleware/auth.middleware.js), which currently lets everything through and is marked `// TODO(auth)`. Those routes are:
- staff create/update
- product update
- reversing outside the undo window
- closing or cancelling a count

## API

Every response is JSON in one of two shapes:

- Success: `{ "success": true, "data": … }`
- Failure: `{ "success": false, "message": "…", "code": "…", "details": [{ "field", "message" }] }`. `code` and `details` appear only when they apply.

Times are ISO 8601 in UTC. Report and list ranges are half-open: `[from, to)`.

| Method | Path | Body / query | Notes |
|---|---|---|---|
| `GET` | `/api/health` | | Database ping |
| `GET` | `/api/staff` | `?active=true\|false` | |
| `POST` | `/api/staff` | `{ name, role? }` | Owner. Role: owner / manager / stylist (default) / other |
| `PATCH` | `/api/staff/:id` | `{ name?, role?, isActive? }` | Owner |
| `GET` | `/api/products` | `?category=&active=&search=&lowStock=true` | Each product includes `inStock` and `isLowStock` (`inStock <= reorderLevel`) |
| `GET` | `/api/products/barcode/:barcode` | | Product with `inStock`, or `404 NOT_REGISTERED` |
| `POST` | `/api/products` | `{ barcode, name, category, unitCost, reorderLevel? }` | Used by Stock In |
| `PATCH` | `/api/products/:id` | `{ name?, category?, unitCost?, reorderLevel?, isActive? }` | Owner. There is no delete. |
| `POST` | `/api/receipts` | `{ reference?, supplier?, isOpening?, lines: [{ barcode, qty, unitCost? }] }` | Every barcode must already be registered |
| `GET` | `/api/receipts` | `?from&to` | With line count, units and ₹ total |
| `GET` | `/api/receipts/:id` | | With its movements |
| `POST` | `/api/movements` | `{ barcode, type: used\|sold\|damaged, qty, takenBy, note?, confirmNegative? }` | Returns `{ movement, product }`, with the product's new `inStock` |
| `POST` | `/api/movements/:id/undo` | `{ note? }` | Within 60 s. Default note "Undone at scan time" |
| `POST` | `/api/movements/:id/reverse` | `{ note }` | Owner. A reason is required |
| `GET` | `/api/movements` | `?from&to&productId&staffId&type&page&pageSize` | Newest first; returns `{ items, page, pageSize, total }`. Rows include `isReversed`, `reversedById` and `reversesId` |
| `GET` | `/api/counts` | | All counts, with missing/surplus totals |
| `GET` | `/api/counts/current` | | The open count with its lines (no expected quantities), or `null` |
| `POST` | `/api/counts` | `{ note? }` | Start a count |
| `POST` | `/api/counts/:id/scan` | `{ barcode }` | Adds 1; returns the line |
| `PUT` | `/api/counts/:id/lines/:productId` | `{ countedQty }` | Sets the line directly |
| `GET` | `/api/counts/:id/preview` | | Expected vs counted, with ₹ and totals |
| `POST` | `/api/counts/:id/close` | | Owner. Writes the adjustments |
| `POST` | `/api/counts/:id/cancel` | | Owner. No movements are written |
| `GET` | `/api/counts/:id` | | Closed: `results` + `totals`. Open or cancelled: `lines` |
| `GET` | `/api/reports/summary` | `?from&to&category=` | One row per product (see below). Also returns `totals` and `lastCountClosedAt` |
| `GET` | `/api/reports/by-staff` | `?from&to` | Per staff member, used/sold/damaged units and ₹, with a per-product breakdown |
| `GET` | `/api/reports/low-stock` | | Active products at or below their reorder level |

Each summary row contains:
- `openingBalance`: stock before `from`
- `bought` / `boughtValue`: opening + purchase in the period
- `used`, `sold`, `damaged`, each with a ₹ value
- `missing` / `missingValue`: negative count adjustments
- `surplus` / `surplusValue`: positive count adjustments
- `closingBalance`: stock before `to`
- `inStockNow`, `isLowStock`

### Error codes

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid input; see `details` |
| 404 | `NOT_REGISTERED` | Unknown barcode ("Not registered yet. Add it through Stock In.") |
| 404 | `PRODUCT_NOT_FOUND`, `STAFF_NOT_FOUND`, `MOVEMENT_NOT_FOUND`, `RECEIPT_NOT_FOUND`, `COUNT_NOT_FOUND`, `ROUTE_NOT_FOUND` | Unknown id or route |
| 409 | `PRODUCT_INACTIVE`, `STAFF_INACTIVE` | The product or person is deactivated |
| 409 | `ALREADY_REGISTERED`, `STAFF_NAME_TAKEN`, `DUPLICATE_ENTRY` | Duplicate barcode or name |
| 409 | `INSUFFICIENT_STOCK` | The out-movement would go below 0; resend with `confirmNegative: true` |
| 409 | `ALREADY_REVERSED`, `CANNOT_REVERSE_REVERSAL`, `CANNOT_REVERSE_COUNT`, `UNDO_WINDOW_PASSED` | Reversal rules |
| 409 | `COUNT_ALREADY_OPEN`, `COUNT_NOT_OPEN` | Count rules |
| 503 | `DB_UNAVAILABLE` | The health check can't reach MySQL |

## Project structure

```
api/
  router/       *.router.js      routes → controller functions (owner routes marked TODO(auth))
  controller/   *.controller.js  read the request, call one service, send the response
  service/      *.service.js     validation first, then business rules, then the model
  model/        *.model.js       SQL only
util/           *.validator.js   Zod schemas (common.validator.js holds shared fields and validate())
middleware/     error.middleware.js (404 + JSON errors), auth.middleware.js (requireOwner)
config/         database.js (mysql2 pool), transaction.js (withTransaction), schema.sql, seed.sql
scripts/        ledger-scenario.test.js
app.js
```

Modules: `health`, `staff`, `product`, `movement`, `receipt`, `count`, `report`.

### Layer rules

Request flow: `router → middleware (if attached) → controller → service → model`

- **Router**: only maps routes to controller functions. It attaches `requireOwner` to owner-only routes.
- **Controller**: only parses the request, calls one service function and sends the response. There is no try/catch: Express 5 forwards rejected promises to the error middleware.
- **Service**:
  - The first statement validates the input with the matching validator, which throws a 400 before anything else runs.
  - Then come the business rules, thrown as `createError(status, message, { code })`, and then the model calls.
  - Multi-statement writes run in `withTransaction` from `config/transaction.js`, which passes `connection` to every model call inside.
  - `listCounts`, `getCurrentCount`, `getLowStock` and the health check take no input, so they have nothing to validate.
- **Model**: only SQL, through the pool, or through the transaction's connection when one is passed.
- **Validator** (`util/*.validator.js`): Zod schemas, called only from services.

## Notes

- Times are stored in **UTC**: every connection runs `SET time_zone = '+00:00'`, and so does `seed.sql`. The frontend turns local (IST) dates into UTC ranges.
- `decimalNumbers` is enabled, so ₹ values and sums come back as numbers. `TINYINT(1)` flags come back as booleans.
- The SQL is MySQL 5.7-compatible.
