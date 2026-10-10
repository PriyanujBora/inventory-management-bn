const db = require('../../config/database');

const BASE_COLUMNS = `p.id, p.barcode, p.name, p.category, p.unit_cost AS unitCost, p.reorder_level AS reorderLevel,
  p.is_active AS isActive, p.created_at AS createdAt, p.updated_at AS updatedAt`;

// Stock on hand is never stored: it is the sum of the product's ledger rows.
const IN_STOCK_COLUMN = '(SELECT COALESCE(SUM(m.qty), 0) FROM stock_movements m WHERE m.product_id = p.id) AS inStock';

// Every null filter matches all rows.
const findAll = async ({ category = null, active = null, search = null, lowStock = null } = {}) => {
  const pattern = search === null ? null : `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const [rows] = await db.query(
    `SELECT ${BASE_COLUMNS}, ${IN_STOCK_COLUMN}
       FROM products p
      WHERE (? IS NULL OR p.category = ?)
        AND (? IS NULL OR p.is_active = ?)
        AND (? IS NULL OR p.name LIKE ? OR p.barcode LIKE ?)
     HAVING (? IS NULL OR inStock <= reorderLevel)
      ORDER BY p.name`,
    [category, category, active, active, pattern, pattern, pattern, lowStock]
  );
  return rows;
};

const findById = async (id, connection = db) => {
  const [rows] = await connection.query(`SELECT ${BASE_COLUMNS}, ${IN_STOCK_COLUMN} FROM products p WHERE p.id = ?`, [id]);
  return rows[0] ?? null;
};

const findByBarcode = async (barcode, connection = db) => {
  const [rows] = await connection.query(`SELECT ${BASE_COLUMNS}, ${IN_STOCK_COLUMN} FROM products p WHERE p.barcode = ?`, [
    barcode,
  ]);
  return rows[0] ?? null;
};

// Row lock that serialises every stock change for one product until the transaction ends.
const lockByBarcode = async (connection, barcode) => {
  const [rows] = await connection.query(`SELECT ${BASE_COLUMNS} FROM products p WHERE p.barcode = ? FOR UPDATE`, [barcode]);
  return rows[0] ?? null;
};

const lockById = async (connection, id) => {
  const [rows] = await connection.query(`SELECT ${BASE_COLUMNS} FROM products p WHERE p.id = ? FOR UPDATE`, [id]);
  return rows[0] ?? null;
};

const lockActive = async (connection) => {
  await connection.query('SELECT id FROM products WHERE is_active = 1 FOR UPDATE');
};

const create = async ({ barcode, name, category, unitCost, reorderLevel }) => {
  const [result] = await db.query(
    'INSERT INTO products (barcode, name, category, unit_cost, reorder_level) VALUES (?, ?, ?, ?, ?)',
    [barcode, name, category, unitCost, reorderLevel]
  );
  return result.insertId;
};

// Only the given fields change; undefined means "keep".
const update = async (id, { name, category, unitCost, reorderLevel, isActive }) => {
  await db.query(
    `UPDATE products
        SET name = COALESCE(?, name),
            category = COALESCE(?, category),
            unit_cost = COALESCE(?, unit_cost),
            reorder_level = COALESCE(?, reorder_level),
            is_active = COALESCE(?, is_active)
      WHERE id = ?`,
    [name ?? null, category ?? null, unitCost ?? null, reorderLevel ?? null, isActive ?? null, id]
  );
};

const updateUnitCost = async (connection, id, unitCost) => {
  await connection.query('UPDATE products SET unit_cost = ? WHERE id = ?', [unitCost, id]);
};

module.exports = {
  findAll,
  findById,
  findByBarcode,
  lockByBarcode,
  lockById,
  lockActive,
  create,
  update,
  updateUnitCost,
};
