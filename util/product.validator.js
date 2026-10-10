const { z } = require('zod');
const { barcodeField, typeField, statusField, validate } = require('./common.validator');

const nameField = z
  .string({ error: (issue) => (issue.input === undefined ? 'Name is required' : 'Name must be text') })
  .trim()
  .max(255, 'Name must be at most 255 characters');

// Products may be unnamed: an empty name is stored as NULL.
const emptyToNull = (name) => name || null;

const registerProductSchema = z.object({
  barcode: barcodeField,
  type: typeField,
  name: nameField.nullish().transform(emptyToNull),
});

const listProductsSchema = z.object({
  type: typeField.optional(),
  status: statusField.optional(),
});

const renameProductSchema = z.object({
  id: z.coerce
    .number({ error: 'Product id must be a number' })
    .int('Product id must be a whole number')
    .positive('Product id must be a positive number'),
  // Required here, but an empty string is allowed and clears the name.
  name: nameField.transform(emptyToNull),
});

const validateRegisterProduct = (data) => validate(registerProductSchema, data);

const validateListProducts = (data) => validate(listProductsSchema, data);

const validateRenameProduct = (data) => validate(renameProductSchema, data);

module.exports = { validateRegisterProduct, validateListProducts, validateRenameProduct };
