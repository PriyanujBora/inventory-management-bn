// Proves the ledger maths end to end through the HTTP API, on a throwaway database.
//   npm test
// Uses the MySQL credentials from .env, creates `inventory_management_test` from config/schema.sql,
// and drops it again afterwards. The dev database is never touched.
require('dotenv').config({ quiet: true });

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const TEST_DB = 'inventory_management_test';
const connectionOptions = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
};

let server;
let baseUrl;
let db;

const call = async (method, urlPath, body) => {
  const response = await fetch(`${baseUrl}/api${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  assert.ok(response.ok, `${method} ${urlPath} -> ${response.status} ${payload.message}`);
  return payload.data;
};

before(async () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'config', 'schema.sql'), 'utf8');
  const admin = await mysql.createConnection(connectionOptions);
  await admin.query(schema.replaceAll('inventory_management', TEST_DB));
  await admin.end();

  // The app's pool reads DB_NAME when config/database.js is first required.
  process.env.DB_NAME = TEST_DB;
  const app = require('../app');
  db = require('../config/database');
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.end();
  const admin = await mysql.createConnection(connectionOptions);
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
  await admin.end();
});

test('opening + purchase − usage − sales + undo, then a count finds 3 missing', async () => {
  const stylistA = await call('POST', '/staff', { name: 'Stylist A', role: 'stylist' });
  const stylistB = await call('POST', '/staff', { name: 'Stylist B', role: 'stylist' });
  const barcode = '8900000000123';
  const product = await call('POST', '/products', {
    barcode,
    name: 'Developer 6%',
    category: 'professional',
    unitCost: 100,
  });

  // 1. Opening 10 units at ₹100
  await call('POST', '/receipts', { isOpening: true, lines: [{ barcode, qty: 10, unitCost: 100 }] });
  // 2. Purchase 5 at ₹120: becomes the product's current cost
  await call('POST', '/receipts', { reference: 'BILL-1', lines: [{ barcode, qty: 5, unitCost: 120 }] });
  assert.equal((await call('GET', `/products/barcode/${barcode}`)).unitCost, 120);

  // 3. Stylist A: three separate "used" scans of 1
  const usedScans = [];
  for (let i = 0; i < 3; i += 1) {
    usedScans.push(await call('POST', '/movements', { barcode, type: 'used', qty: 1, takenBy: stylistA.id }));
  }
  // 4. Stylist B: 1 sold
  await call('POST', '/movements', { barcode, type: 'sold', qty: 1, takenBy: stylistB.id });
  // 5. Undo one of A's
  const undo = await call('POST', `/movements/${usedScans[1].movement.id}/undo`, { note: 'Undone at scan time' });
  assert.equal(undo.reversal.qty, 1);
  assert.equal(undo.reversal.type, 'used');
  assert.equal(undo.original.isReversed, true);

  // 6. Stock before the count: 10 + 5 − 3 − 1 + 1 = 12
  assert.equal((await call('GET', `/products/barcode/${barcode}`)).inStock, 12);

  // 7. Count finds 9 (scanned one by one)
  const count = await call('POST', '/counts', { note: 'Scenario count' });
  let line;
  for (let i = 0; i < 9; i += 1) line = await call('POST', `/counts/${count.id}/scan`, { barcode });
  assert.equal(line.countedQty, 9);

  const preview = await call('GET', `/counts/${count.id}/preview`);
  const previewRow = preview.rows.find((row) => row.productId === product.id);
  assert.deepEqual(
    { expected: previewRow.expected, counted: previewRow.counted, difference: previewRow.difference },
    { expected: 12, counted: 9, difference: -3 }
  );
  assert.equal(previewRow.differenceValue, -360);

  const closed = await call('POST', `/counts/${count.id}/close`);
  assert.equal(closed.status, 'closed');
  assert.deepEqual(
    { missingUnits: closed.totals.missingUnits, missingValue: closed.totals.missingValue },
    { missingUnits: 3, missingValue: 360 }
  );
  assert.equal((await call('GET', `/products/barcode/${barcode}`)).inStock, 9);

  // A later cost change must not rewrite history: values come from each row's snapshot.
  await call('PATCH', `/products/${product.id}`, { unitCost: 999 });

  // 8. Summary for a window around the whole scenario
  const from = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const summary = await call('GET', `/reports/summary?from=${from}&to=${to}`);
  const row = summary.rows.find((r) => r.productId === product.id);

  assert.deepEqual(
    {
      openingBalance: row.openingBalance,
      bought: row.bought,
      used: row.used,
      sold: row.sold,
      damaged: row.damaged,
      missing: row.missing,
      surplus: row.surplus,
      closingBalance: row.closingBalance,
      inStockNow: row.inStockNow,
    },
    { openingBalance: 0, bought: 15, used: 2, sold: 1, damaged: 0, missing: 3, surplus: 0, closingBalance: 9, inStockNow: 9 }
  );
  assert.equal(row.boughtValue, 10 * 100 + 5 * 120);
  assert.equal(row.usedValue, 2 * 120);
  assert.equal(row.soldValue, 120);
  assert.equal(row.missingValue, 3 * 120, 'missing ₹ uses the cost snapshot at count time, not today’s ₹999');
  assert.equal(summary.totals.missingValue, 360);
  assert.ok(summary.lastCountClosedAt);

  // Staff usage: A used 2 (one of three undone), B sold 1
  const usage = await call('GET', `/reports/by-staff?from=${from}&to=${to}`);
  const a = usage.rows.find((r) => r.staffId === stylistA.id);
  const b = usage.rows.find((r) => r.staffId === stylistB.id);
  assert.deepEqual({ used: a.used, usedValue: a.usedValue, sold: a.sold }, { used: 2, usedValue: 240, sold: 0 });
  assert.deepEqual({ used: b.used, sold: b.sold, soldValue: b.soldValue }, { used: 0, sold: 1, soldValue: 120 });
});
