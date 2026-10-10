const db = require('../../config/database');

// The ledger is append-only: this module inserts and reads, never updates or deletes.

const LEDGER_SELECT = `
  SELECT m.id, m.type, m.qty, m.unit_cost AS unitCost, m.note, m.created_at AS createdAt,
         m.product_id AS productId, p.name AS productName, p.barcode, p.category,
         m.taken_by AS takenBy, s.name AS takenByName,
         m.receipt_id AS receiptId, m.count_id AS countId,
         m.reverses_id AS reversesId, r.id AS reversedById
    FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN staff s ON s.id = m.taken_by
    LEFT JOIN stock_movements r ON r.reverses_id = m.id`;

// Every null filter matches all rows; `to` is exclusive.
const LEDGER_FILTERS = `
   WHERE (:from IS NULL OR m.created_at >= :from)
     AND (:to IS NULL OR m.created_at < :to)
     AND (:productId IS NULL OR m.product_id = :productId)
     AND (:staffId IS NULL OR m.taken_by = :staffId)
     AND (:type IS NULL OR m.type = :type)`;

const insert = async (
  connection,
  { productId, type, qty, unitCost = null, takenBy = null, receiptId = null, countId = null, reversesId = null, note = null }
) => {
  const [result] = await connection.query(
    `INSERT INTO stock_movements (product_id, type, qty, unit_cost, taken_by, receipt_id, count_id, reverses_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [productId, type, qty, unitCost, takenBy, receiptId, countId, reversesId, note]
  );
  return result.insertId;
};

const findById = async (id, connection = db) => {
  const [rows] = await connection.query(`${LEDGER_SELECT} WHERE m.id = ?`, [id]);
  return rows[0] ?? null;
};

const findByReceipt = async (receiptId) => {
  const [rows] = await db.query(`${LEDGER_SELECT} WHERE m.receipt_id = ? ORDER BY p.name`, [receiptId]);
  return rows;
};

// Locks the row so two reversals of it can't race; ageSeconds is measured on the database clock.
const lockById = async (connection, id) => {
  const [rows] = await connection.query(
    `SELECT id, product_id AS productId, type, qty, unit_cost AS unitCost, taken_by AS takenBy,
            reverses_id AS reversesId, TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP()) AS ageSeconds
       FROM stock_movements
      WHERE id = ?
        FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
};

const findReversalOf = async (connection, id) => {
  const [rows] = await connection.query('SELECT id FROM stock_movements WHERE reverses_id = ? LOCK IN SHARE MODE', [id]);
  return rows[0] ?? null;
};

// Current stock on hand, read from the latest committed rows (not the transaction's snapshot).
const stockOf = async (connection, productId) => {
  const [rows] = await connection.query(
    'SELECT COALESCE(SUM(qty), 0) AS inStock FROM stock_movements WHERE product_id = ? LOCK IN SHARE MODE',
    [productId]
  );
  return rows[0].inStock;
};

const findPage = async ({ from = null, to = null, productId = null, staffId = null, type = null, limit, offset }) => {
  const params = { from, to, productId, staffId, type, limit, offset };
  const [rows] = await db.query(
    { sql: `${LEDGER_SELECT} ${LEDGER_FILTERS} ORDER BY m.id DESC LIMIT :limit OFFSET :offset`, namedPlaceholders: true },
    params
  );
  const [[{ total }]] = await db.query(
    { sql: `SELECT COUNT(*) AS total FROM stock_movements m ${LEDGER_FILTERS}`, namedPlaceholders: true },
    params
  );
  return { rows, total };
};

module.exports = { insert, findById, findByReceipt, lockById, findReversalOf, stockOf, findPage };
