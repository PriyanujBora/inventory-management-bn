const db = require('../../config/database');

const ping = async () => {
  await db.query('SELECT 1');
};

module.exports = { ping };
