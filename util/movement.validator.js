const { z } = require('zod');
const {
  MOVEMENT_TYPES,
  barcodeField,
  idField,
  qtyField,
  optionalText,
  dateRangeShape,
  rangeIsOrdered,
  RANGE_ORDER_ERROR,
  pageShape,
  validate,
} = require('./common.validator');

// Take Out reasons. opening/purchase come from receipts, count_adjustment from closing a count.
const OUT_TYPES = ['used', 'sold', 'damaged'];

const recordMovementSchema = z.object({
  barcode: barcodeField,
  type: z.enum(OUT_TYPES, { error: 'Type must be "used", "sold" or "damaged"' }),
  qty: qtyField,
  takenBy: z
    .number({ error: (issue) => (issue.input === undefined ? 'Choose who took it (takenBy)' : 'takenBy must be a staff id') })
    .int('takenBy must be a staff id')
    .positive('takenBy must be a staff id'),
  note: optionalText('Note', 255),
  confirmNegative: z.boolean({ error: 'confirmNegative must be true or false' }).default(false),
});

const reasonField = z
  .string({ error: (issue) => (issue.input === undefined ? 'A reason (note) is required' : 'Note must be text') })
  .trim()
  .min(1, 'A reason (note) is required')
  .max(255, 'Note must be at most 255 characters');

const reverseMovementSchema = z.object({
  id: idField('Movement id'),
  note: reasonField,
});

const undoMovementSchema = z.object({
  id: idField('Movement id'),
  note: reasonField.default('Undone at scan time'),
});

const listMovementsSchema = z
  .object({
    ...dateRangeShape(false),
    productId: idField('productId').optional(),
    staffId: idField('staffId').optional(),
    type: z.enum(MOVEMENT_TYPES, { error: `Type must be one of: ${MOVEMENT_TYPES.join(', ')}` }).optional(),
    ...pageShape,
  })
  .refine(rangeIsOrdered, RANGE_ORDER_ERROR);

const validateRecordMovement = (data) => validate(recordMovementSchema, data);

const validateReverseMovement = (data) => validate(reverseMovementSchema, data);

const validateUndoMovement = (data) => validate(undoMovementSchema, data);

const validateListMovements = (data) => validate(listMovementsSchema, data);

module.exports = { validateRecordMovement, validateReverseMovement, validateUndoMovement, validateListMovements };
