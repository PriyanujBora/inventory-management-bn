const db = require('../../config/database');

// Runs `work(connection)` inside a transaction on a dedicated pool connection.
const withTransaction = async (work) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (err) {
    // Surface the original error even if the rollback itself fails.
    await connection.rollback().catch(() => {});
    throw err;
  } finally {
    connection.release();
  }
};

const insertScanLog = (connection, productId, direction) =>
  connection.query('INSERT INTO scan_logs (product_id, direction) VALUES (?, ?)', [productId, direction]);

const createProductWithFirstScan = ({ barcode, name, type, status }) =>
  withTransaction(async (connection) => {
    const [result] = await connection.query(
      'INSERT INTO products (barcode, name, type, status) VALUES (?, ?, ?, ?)',
      [barcode, name, type, status]
    );
    await insertScanLog(connection, result.insertId, status);
    return result.insertId;
  });

// Compare-and-set: the status only changes if it is still `fromStatus`.
// Returns false, writing nothing, when another scan changed it first.
const toggleStatusWithScan = ({ productId, fromStatus, toStatus }) =>
  withTransaction(async (connection) => {
    const [result] = await connection.query(
      'UPDATE products SET status = ? WHERE id = ? AND status = ?',
      [toStatus, productId, fromStatus]
    );
    if (result.affectedRows === 0) return false;

    await insertScanLog(connection, productId, toStatus);
    return true;
  });

// Newest first. A null type matches every product.
const findRecent = async ({ type = null, limit }) => {
  const [rows] = await db.query(
    `SELECT s.id, s.direction, s.scanned_at AS scannedAt,
            p.id AS productId, p.barcode, p.name, p.type
       FROM scan_logs s
       JOIN products p ON p.id = s.product_id
      WHERE (? IS NULL OR p.type = ?)
      ORDER BY s.id DESC
      LIMIT ?`,
    [type, type, limit]
  );
  return rows;
};

module.exports = { createProductWithFirstScan, toggleStatusWithScan, findRecent };
