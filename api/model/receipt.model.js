const db = require('../../config/database');

const RECEIPT_SELECT = `
  SELECT r.id, r.reference, r.supplier, r.is_opening AS isOpening, r.created_at AS createdAt,
         COUNT(m.id) AS lineCount,
         COALESCE(SUM(m.qty), 0) AS units,
         COALESCE(SUM(m.qty * COALESCE(m.unit_cost, 0)), 0) AS totalValue
    FROM stock_receipts r
    LEFT JOIN stock_movements m ON m.receipt_id = r.id`;

const create = async (connection, { reference = null, supplier = null, isOpening }) => {
  const [result] = await connection.query(
    'INSERT INTO stock_receipts (reference, supplier, is_opening) VALUES (?, ?, ?)',
    [reference, supplier, isOpening]
  );
  return result.insertId;
};

const findById = async (id) => {
  const [rows] = await db.query(`${RECEIPT_SELECT} WHERE r.id = ? GROUP BY r.id`, [id]);
  return rows[0] ?? null;
};

// A null bound is open-ended; `to` is exclusive.
const findAll = async ({ from = null, to = null } = {}) => {
  const [rows] = await db.query(
    `${RECEIPT_SELECT}
      WHERE (? IS NULL OR r.created_at >= ?)
        AND (? IS NULL OR r.created_at < ?)
      GROUP BY r.id
      ORDER BY r.id DESC`,
    [from, from, to, to]
  );
  return rows;
};

module.exports = { create, findById, findAll };
