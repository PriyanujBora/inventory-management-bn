const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  // Read and write DATETIME values as UTC; the API returns ISO strings and the browser shows local time.
  timezone: 'Z',
  // DECIMAL columns and SUM() results come back as numbers instead of strings.
  decimalNumbers: true,
  // TINYINT(1) flags (is_active, is_opening) come back as true/false.
  typeCast: (field, next) => {
    if (field.type === 'TINY' && field.length === 1) {
      const value = field.string();
      return value === null ? null : value === '1';
    }
    return next();
  },
});

// Keep every session in UTC so CURRENT_TIMESTAMP defaults line up with `timezone: 'Z'` above,
// whatever time zone the MySQL server itself runs in.
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (err) => {
    if (err) console.error(`Could not set the MySQL session time zone: ${err.message}`);
  });
});

module.exports = pool.promise();
