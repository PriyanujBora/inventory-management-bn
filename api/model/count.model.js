const db = require('../../config/database');

const COUNT_COLUMNS = 'c.id, c.status, c.note, c.started_at AS startedAt, c.closed_at AS closedAt';

const LINE_SELECT = `
  SELECT l.product_id AS productId, p.name, p.barcode, p.category, l.counted_qty AS countedQty, l.updated_at AS updatedAt
    FROM stock_count_lines l
    JOIN products p ON p.id = l.product_id`;

const findById = async (id) => {
  const [rows] = await db.query(`SELECT ${COUNT_COLUMNS} FROM stock_counts c WHERE c.id = ?`, [id]);
  return rows[0] ?? null;
};

const findOpen = async () => {
  const [rows] = await db.query(`SELECT ${COUNT_COLUMNS} FROM stock_counts c WHERE c.status = 'open' ORDER BY c.id LIMIT 1`);
  return rows[0] ?? null;
};

// Locks the open count (or, when none exists, the index gap) so two counts can't start at once.
const lockOpen = async (connection) => {
  const [rows] = await connection.query(`SELECT ${COUNT_COLUMNS} FROM stock_counts c WHERE c.status = 'open' FOR UPDATE`);
  return rows[0] ?? null;
};

// Scans, line edits, close and cancel all lock the count row, so none of them interleave.
const lockById = async (connection, id) => {
  const [rows] = await connection.query(`SELECT ${COUNT_COLUMNS} FROM stock_counts c WHERE c.id = ? FOR UPDATE`, [id]);
  return rows[0] ?? null;
};

// Newest first, with each closed count's missing/surplus totals from its adjustment rows.
const findAll = async () => {
  const [rows] = await db.query(
    `SELECT ${COUNT_COLUMNS},
            (SELECT COUNT(*) FROM stock_count_lines l WHERE l.count_id = c.id AND l.counted_qty > 0) AS productsCounted,
            COALESCE(-SUM(CASE WHEN m.qty < 0 THEN m.qty END), 0) AS missingUnits,
            COALESCE(-SUM(CASE WHEN m.qty < 0 THEN m.qty * COALESCE(m.unit_cost, 0) END), 0) AS missingValue,
            COALESCE(SUM(CASE WHEN m.qty > 0 THEN m.qty END), 0) AS surplusUnits,
            COALESCE(SUM(CASE WHEN m.qty > 0 THEN m.qty * COALESCE(m.unit_cost, 0) END), 0) AS surplusValue
       FROM stock_counts c
       LEFT JOIN stock_movements m ON m.count_id = c.id
      GROUP BY c.id
      ORDER BY c.id DESC`
  );
  return rows;
};

const findLastClosed = async () => {
  const [rows] = await db.query(
    `SELECT ${COUNT_COLUMNS} FROM stock_counts c WHERE c.status = 'closed' ORDER BY c.closed_at DESC, c.id DESC LIMIT 1`
  );
  return rows[0] ?? null;
};

const create = async (connection, { note = null }) => {
  const [result] = await connection.query('INSERT INTO stock_counts (note) VALUES (?)', [note]);
  return result.insertId;
};

const setStatus = async (connection, id, status) => {
  await connection.query('UPDATE stock_counts SET status = ?, closed_at = UTC_TIMESTAMP() WHERE id = ?', [status, id]);
};

const incrementLine = async (connection, countId, productId) => {
  await connection.query(
    `INSERT INTO stock_count_lines (count_id, product_id, counted_qty) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE counted_qty = counted_qty + 1`,
    [countId, productId]
  );
};

const setLine = async (connection, countId, productId, countedQty) => {
  await connection.query(
    `INSERT INTO stock_count_lines (count_id, product_id, counted_qty) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE counted_qty = VALUES(counted_qty), updated_at = CURRENT_TIMESTAMP`,
    [countId, productId, countedQty]
  );
};

const findLine = async (countId, productId, connection = db) => {
  const [rows] = await connection.query(`${LINE_SELECT} WHERE l.count_id = ? AND l.product_id = ?`, [countId, productId]);
  return rows[0] ?? null;
};

// Most recently scanned first, as the counter sees them. Expected quantities are deliberately absent.
const findLines = async (countId) => {
  const [rows] = await db.query(`${LINE_SELECT} WHERE l.count_id = ? ORDER BY l.updated_at DESC, p.name`, [countId]);
  return rows;
};

// Every active product with its ledger stock (expected) and what was counted (0 if never scanned).
// Products expected and counted at 0 are left out.
const findExpectedVsCounted = async (countId, connection = db) => {
  const [rows] = await connection.query(
    `SELECT p.id AS productId, p.name, p.barcode, p.category, p.unit_cost AS unitCost,
            (SELECT COALESCE(SUM(m.qty), 0) FROM stock_movements m WHERE m.product_id = p.id) AS expected,
            COALESCE(l.counted_qty, 0) AS counted
       FROM products p
       LEFT JOIN stock_count_lines l ON l.count_id = ? AND l.product_id = p.id
      WHERE p.is_active = 1
     HAVING expected <> 0 OR counted <> 0
      ORDER BY p.name`,
    [countId]
  );
  return rows;
};

const saveExpected = async (connection, countId, productId, countedQty, expectedQty) => {
  await connection.query(
    `INSERT INTO stock_count_lines (count_id, product_id, counted_qty, expected_qty) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE expected_qty = VALUES(expected_qty)`,
    [countId, productId, countedQty, expectedQty]
  );
};

// A closed count's outcome per product; the value uses the adjustment row's cost snapshot.
const findResults = async (countId) => {
  const [rows] = await db.query(
    `SELECT l.product_id AS productId, p.name, p.barcode, p.category,
            l.expected_qty AS expected, l.counted_qty AS counted,
            COALESCE(m.qty, 0) AS difference,
            COALESCE(m.unit_cost, p.unit_cost) AS unitCost,
            COALESCE(m.qty * COALESCE(m.unit_cost, 0), 0) AS differenceValue
       FROM stock_count_lines l
       JOIN products p ON p.id = l.product_id
       LEFT JOIN stock_movements m
              ON m.count_id = l.count_id AND m.product_id = l.product_id AND m.type = 'count_adjustment'
      WHERE l.count_id = ? AND l.expected_qty IS NOT NULL
      ORDER BY differenceValue, p.name`,
    [countId]
  );
  return rows;
};

module.exports = {
  findById,
  findOpen,
  lockOpen,
  lockById,
  findAll,
  findLastClosed,
  create,
  setStatus,
  incrementLine,
  setLine,
  findLine,
  findLines,
  findExpectedVsCounted,
  saveExpected,
  findResults,
};
