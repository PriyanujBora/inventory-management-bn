const { z } = require('zod');
const createError = require('http-errors');

const PRODUCT_CATEGORIES = ['professional', 'retail'];
const STAFF_ROLES = ['owner', 'manager', 'stylist', 'other'];
const MOVEMENT_TYPES = ['opening', 'purchase', 'used', 'sold', 'damaged', 'count_adjustment'];
const MAX_QTY = 10000;

const requiredText = (label) => (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be text`);

// Barcodes arrive as typed text (USB/Bluetooth scanners act like keyboards) or from the camera.
const barcodeField = z
  .string({ error: requiredText('Barcode') })
  .trim()
  .min(1, 'Barcode is required')
  .max(128, 'Barcode must be at most 128 characters')
  .regex(/^[\x20-\x7E]*$/, 'Barcode may only contain printable ASCII characters');

// Ids from the URL or query string arrive as text.
const idField = (label) =>
  z.coerce
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .positive(`${label} must be a positive number`);

// Whole units; the server applies the sign.
const qtyField = z
  .number({ error: (issue) => (issue.input === undefined ? 'Quantity is required' : 'Quantity must be a number') })
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(MAX_QTY, `Quantity must be at most ${MAX_QTY}`);

// Rupees with at most 2 decimals.
const moneyField = (label) =>
  z
    .number({ error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be a number`) })
    .min(0, `${label} cannot be negative`)
    .max(99999999.99, `${label} is too large`)
    .multipleOf(0.01, `${label} can have at most 2 decimals`);

const categoryField = z.enum(PRODUCT_CATEGORIES, { error: 'Category must be "professional" or "retail"' });

// Optional free text: trimmed, empty becomes undefined.
const optionalText = (label, max) =>
  z
    .string({ error: `${label} must be text` })
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .nullish()
    .transform((value) => value || undefined);

// ?active=true|false in a query string
const booleanQuery = (label) =>
  z.enum(['true', 'false'], { error: `${label} must be "true" or "false"` }).transform((value) => value === 'true');

// ISO 8601 timestamp, e.g. 2026-10-01T00:00:00.000Z (the frontend sends local midnight converted to UTC)
const timestampField = (label) =>
  z.iso
    .datetime({ offset: true, error: `${label} must be an ISO date-time, e.g. 2026-10-01T00:00:00.000Z` })
    .transform((value) => new Date(value));

// Half-open range [from, to)
const dateRangeShape = (required) => {
  const from = timestampField('from');
  const to = timestampField('to');
  return required ? { from, to } : { from: from.optional(), to: to.optional() };
};

const rangeIsOrdered = (range) => !range.from || !range.to || range.from < range.to;
const RANGE_ORDER_ERROR = { message: '"from" must be before "to"', path: ['to'] };

const pageShape = {
  page: z.coerce.number({ error: 'page must be a number' }).int().min(1, 'page must be at least 1').default(1),
  pageSize: z.coerce
    .number({ error: 'pageSize must be a number' })
    .int()
    .min(1, 'pageSize must be at least 1')
    .max(200, 'pageSize must be at most 200')
    .default(50),
};

// Returns the parsed (trimmed, coerced) data, or throws a 400 listing every invalid field.
const validate = (schema, data) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw createError(400, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return result.data;
};

module.exports = {
  PRODUCT_CATEGORIES,
  STAFF_ROLES,
  MOVEMENT_TYPES,
  MAX_QTY,
  barcodeField,
  idField,
  qtyField,
  moneyField,
  categoryField,
  optionalText,
  booleanQuery,
  dateRangeShape,
  rangeIsOrdered,
  RANGE_ORDER_ERROR,
  pageShape,
  validate,
};
