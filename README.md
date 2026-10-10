# inventory-management-bn

Backend of **inventory-management**: an Express + MySQL API where scanning a product's barcode toggles it **IN** and **OUT** of the inventory.

- The first scan of a new barcode registers it (name optional, plus its type) and puts it **IN**.
- Every scan after that flips it: IN → OUT → IN → …
- Products are **consumables** or **sellables**. A scan only goes through when the scan screen's switch matches the product's type.
- Every scan is written to a log.

Frontend: [inventory-management-fn](https://github.com/PriyanujBora/inventory-management-fn)

## Requirements

- Node.js 18+ (developed on Node 24)
- MySQL 5.7+ or 8.x

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the database and tables. The script is safe to re-run.

   ```bash
   mysql -u root -p < config/schema.sql
   ```

   Or paste [config/schema.sql](config/schema.sql) into phpMyAdmin or MySQL Workbench. With MySQL running in Docker:

   ```bash
   docker exec -i <mysql-container> mysql -uroot < config/schema.sql
   ```

3. Copy `.env.example` to `.env` and fill in your MySQL credentials.

4. Start the API. nodemon restarts it whenever a file changes.

   ```bash
   npm run dev     # npm start does the same
   ```

   Once MySQL is reachable it prints `API running on http://localhost:5000`. If MySQL can't be reached, it prints the connection error and exits.

## Environment variables

| Variable | Example | Notes |
|---|---|---|
| `PORT` | `5000` | Must match the frontend's `VITE_API_URL` |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Frontend origin(s) allowed by CORS, comma-separated |
| `DB_HOST` | `127.0.0.1` | Prefer `127.0.0.1` over `localhost` on Windows |
| `DB_PORT` | `3306` | |
| `DB_USER` | `root` | |
| `DB_PASSWORD` | | May be empty |
| `DB_NAME` | `inventory_management` | Created by `config/schema.sql` |
| `DB_CONNECTION_LIMIT` | `10` | Optional |

## API

Every response is JSON in one of two shapes:

- Success: `{ "success": true, "data": … }`
- Failure: `{ "success": false, "message": "…", "code": "…", "details": [{ "field", "message" }] }`. `code` and `details` appear only when they apply.

| Method | Path | Body / query | Result |
|---|---|---|---|
| `POST` | `/api/scans` | `{ "barcode", "type" }` | **201** `{ action: "in" \| "out", isNew: false, product }` |
| `GET` | `/api/scans` | `?type=consumable\|sellable&limit=1..500` (default 50) | Scan log, newest first, with the product's barcode, name and type |
| `POST` | `/api/products` | `{ "barcode", "type", "name"? }` | **201** `{ action: "in", isNew: true, product }`: registers the barcode and records its first IN scan |
| `GET` | `/api/products` | `?type=…&status=in\|out` | Products, most recently updated first |
| `PATCH` | `/api/products/:id` | `{ "name" }` | The renamed product. An empty `name` clears it. |

Error codes:

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR` (see `details`) |
| 404 | `NOT_REGISTERED` (unknown barcode: register it with `POST /api/products`), `PRODUCT_NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | `TYPE_MISMATCH` (switch doesn't match the product's type), `ALREADY_REGISTERED`, `SCAN_CONFLICT`, `DUPLICATE_ENTRY` |

```bash
curl -X POST http://localhost:5000/api/scans \
  -H "Content-Type: application/json" \
  -d '{"barcode":"8901234567890","type":"consumable"}'
```

## Project structure

```
api/
  router/       *.router.js      routes → controller functions
  controller/   *.controller.js  read the request, call one service, send the response
  service/      *.service.js     validation first, then business rules, then the model
  model/        *.model.js       SQL only
util/           *.validator.js   Zod schemas (common.validator.js holds shared fields and the validate() helper)
middleware/     error.middleware.js  404 handler + JSON error handler
config/         database.js (mysql2 pool), schema.sql
app.js
```

### Layer rules

Request flow: `router → middleware (if attached) → controller → service → model`

- **Router**: only maps routes to controller functions. No logic, validation or DB calls.
- **Controller**: only parses the request, calls the matching service function and sends the response. There is no try/catch: Express 5 forwards rejected promises to the error middleware.
- **Service**: required for every module. The first statement validates the input with the matching validator, which throws a 400 before anything else runs. Then come the business rules, then the model calls. Business errors are thrown with [`http-errors`](https://www.npmjs.com/package/http-errors) (`createError(409, message, { code })`).
- **Model**: only SQL, through the promisified pool from `config/database.js`. There is no validation or business logic here. Multi-statement writes run in a transaction inside `scan.model.js`.
- **Validator** (`util/*.validator.js`): Zod schemas, called only from services.
- **Middleware**: Express middleware, attached at app or router level.

## Notes

- Times are stored in **UTC**: every connection runs `SET time_zone = '+00:00'`. The API returns ISO 8601 strings and the frontend shows them in local time. phpMyAdmin will show the raw UTC values.
- The SQL is MySQL 5.7-compatible.
