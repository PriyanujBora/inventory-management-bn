require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const db = require('./config/database');
const productRouter = require('./api/router/product.router');
const scanRouter = require('./api/router/scan.router');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app = express();

// The frontend calls the API from another origin (e.g. http://localhost:5173); comma-separate several.
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use('/api/products', productRouter);
app.use('/api/scans', scanRouter);

app.use(notFound);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

// Fail fast with a clear message when MySQL is unreachable, instead of erroring on the first request.
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
