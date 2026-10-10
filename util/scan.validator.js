const { z } = require('zod');
const { barcodeField, typeField, validate } = require('./common.validator');

const scanSchema = z.object({
  barcode: barcodeField,
  // Position of the Consumables / Sellables switch on the scan screen
  type: typeField,
});

const listScansSchema = z.object({
  type: typeField.optional(),
  limit: z.coerce
    .number({ error: 'Limit must be a number' })
    .int('Limit must be a whole number')
    .min(1, 'Limit must be at least 1')
    .max(500, 'Limit must be at most 500')
    .default(50),
});

const validateScan = (data) => validate(scanSchema, data);

const validateListScans = (data) => validate(listScansSchema, data);

module.exports = { validateScan, validateListScans };
