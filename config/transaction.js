const db = require('./database');

// Runs `work(connection)` inside a transaction on a dedicated pool connection.
// Services use it for multi-statement writes and pass `connection` to every model call inside.
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

module.exports = { withTransaction };
