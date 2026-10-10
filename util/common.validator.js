const { z } = require('zod');
const createError = require('http-errors');

const PRODUCT_TYPES = ['consumable', 'sellable'];
const PRODUCT_STATUSES = ['in', 'out'];

// Barcodes arrive as typed text (USB/Bluetooth scanners act like keyboards) or from the camera.
const barcodeField = z
  .string({ error: (issue) => (issue.input === undefined ? 'Barcode is required' : 'Barcode must be text') })
  .trim()
  .min(1, 'Barcode is required')
  .max(128, 'Barcode must be at most 128 characters')
  .regex(/^[\x20-\x7E]*$/, 'Barcode may only contain printable ASCII characters');

const typeField = z.enum(PRODUCT_TYPES, { error: 'Type must be "consumable" or "sellable"' });

const statusField = z.enum(PRODUCT_STATUSES, { error: 'Status must be "in" or "out"' });

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

module.exports = { PRODUCT_TYPES, PRODUCT_STATUSES, barcodeField, typeField, statusField, validate };
