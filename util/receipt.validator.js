const { z } = require('zod');
const {
  barcodeField,
  idField,
  qtyField,
  moneyField,
  optionalText,
  dateRangeShape,
  rangeIsOrdered,
  RANGE_ORDER_ERROR,
  validate,
} = require('./common.validator');

const receiptLineSchema = z.object({
  barcode: barcodeField,
  qty: qtyField,
  // Omitted: the product's current cost is used
  unitCost: moneyField('Unit cost').optional(),
});

const createReceiptSchema = z.object({
  reference: optionalText('Supplier bill no.', 100),
  supplier: optionalText('Supplier', 150),
  isOpening: z.boolean({ error: 'isOpening must be true or false' }).default(false),
  lines: z
    .array(receiptLineSchema, { error: 'lines must be a list of { barcode, qty, unitCost? }' })
    .min(1, 'Add at least one product to the receipt')
    .max(500, 'A receipt can have at most 500 lines'),
});

const listReceiptsSchema = z.object({ ...dateRangeShape(false) }).refine(rangeIsOrdered, RANGE_ORDER_ERROR);

const receiptIdSchema = z.object({ id: idField('Receipt id') });

const validateCreateReceipt = (data) => validate(createReceiptSchema, data);

const validateListReceipts = (data) => validate(listReceiptsSchema, data);

const validateReceiptId = (data) => validate(receiptIdSchema, data);

module.exports = { validateCreateReceipt, validateListReceipts, validateReceiptId };
