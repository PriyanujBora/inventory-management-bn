const db = require('../../config/database');

const PRODUCT_COLUMNS = 'id, barcode, name, type, status, created_at AS createdAt, updated_at AS updatedAt';

const findById = async (id) => {
  const [rows] = await db.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

const findByBarcode = async (barcode) => {
  const [rows] = await db.query(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE barcode = ?`, [barcode]);
  return rows[0] ?? null;
};

// A null filter matches every row.
const findAll = async ({ type = null, status = null } = {}) => {
  const [rows] = await db.query(
    `SELECT ${PRODUCT_COLUMNS}
       FROM products
      WHERE (? IS NULL OR type = ?)
        AND (? IS NULL OR status = ?)
      ORDER BY updated_at DESC, id DESC`,
    [type, type, status, status]
  );
  return rows;
};

const updateName = async (id, name) => {
  await db.query('UPDATE products SET name = ? WHERE id = ?', [name, id]);
};

module.exports = { findById, findByBarcode, findAll, updateName };
