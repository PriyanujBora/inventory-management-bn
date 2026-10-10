const createError = require('http-errors');
const healthModel = require('../model/health.model');

// Takes no input, so there is nothing to validate.
const checkHealth = async () => {
  try {
    await healthModel.ping();
  } catch (err) {
    throw createError(503, `Database unreachable: ${err.message}`, { code: 'DB_UNAVAILABLE', expose: true });
  }
  return { status: 'ok', database: 'ok', time: new Date().toISOString() };
};

module.exports = { checkHealth };
