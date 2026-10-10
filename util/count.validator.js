const { z } = require('zod');
const { barcodeField, idField, optionalText, validate } = require('./common.validator');

const startCountSchema = z.object({
  note: optionalText('Note', 255),
});

const countIdSchema = z.object({ id: idField('Count id') });

const countScanSchema = z.object({
  id: idField('Count id'),
  barcode: barcodeField,
});

const setCountLineSchema = z.object({
  id: idField('Count id'),
  productId: idField('Product id'),
  countedQty: z
    .number({ error: (issue) => (issue.input === undefined ? 'countedQty is required' : 'countedQty must be a number') })
    .int('countedQty must be a whole number')
    .min(0, 'countedQty cannot be negative')
    .max(100000, 'countedQty is too large'),
});

const validateStartCount = (data) => validate(startCountSchema, data);

const validateCountId = (data) => validate(countIdSchema, data);

const validateCountScan = (data) => validate(countScanSchema, data);

const validateSetCountLine = (data) => validate(setCountLineSchema, data);

module.exports = { validateStartCount, validateCountId, validateCountScan, validateSetCountLine };
