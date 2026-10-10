require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const db = require('./config/database');
const healthRouter = require('./api/router/health.router');
const staffRouter = require('./api/router/staff.router');
const productRouter = require('./api/router/product.router');
const movementRouter = require('./api/router/movement.router');
const receiptRouter = require('./api/router/receipt.router');
const countRouter = require('./api/router/count.router');
const reportRouter = require('./api/router/report.router');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

// The frontend calls the API from another origin (e.g. http://localhost:5173); comma-separate several.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/staff', staffRouter);
app.use('/api/products', productRouter);
app.use('/api/movements', movementRouter);
app.use('/api/receipts', receiptRouter);
app.use('/api/counts', countRouter);
app.use('/api/reports', reportRouter);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

// Fail fast with a clear message when MySQL is unreachable, instead of erroring on the first request.
// Skipped when the app is required by tests, which start their own server.
if (require.main === module) {
  db.getConnection()
    .then((connection) => {
      connection.release();
      console.log(`Connected to MySQL database "${process.env.DB_NAME}"`);

      app.listen(PORT, (err) => {
        if (err) {
          console.error(`Could not start the API on port ${PORT}: ${err.message}`);
          process.exit(1);
        }
        console.log(`API running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error(`Could not connect to MySQL: ${err.message}`);
      process.exit(1);
    });
}

module.exports = app;
