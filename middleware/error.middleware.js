const createError = require('http-errors');

const notFound = (req, res, next) => {
  next(createError(404, `Route not found: ${req.method} ${req.originalUrl}`, { code: 'ROUTE_NOT_FOUND' }));
};

// Express only treats a middleware as an error handler when it takes four arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Unique-key race, e.g. the same new barcode registered from two devices at once.
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, code: 'DUPLICATE_ENTRY', message: 'This record already exists.' });
  }

  const status = err.status || err.statusCode || 500;
  // http-errors marks 4xx as exposable; a 5xx is only shown when the service opted in (e.g. the health check).
  const isExposed = err.expose ?? status < 500;

  // Unexpected errors are logged and never leak internals to the client.
  if (!isExposed) {
    console.error(err);
    return res.status(status).json({ success: false, message: 'Internal server error' });
  }

  res.status(status).json({
    success: false,
    message: err.message,
    ...(typeof err.code === 'string' && { code: err.code }),
    ...(err.details && { details: err.details }),
  });
};

module.exports = { notFound, errorHandler };
