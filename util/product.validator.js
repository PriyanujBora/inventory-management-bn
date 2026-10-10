const { z } = require('zod');
const {
  barcodeField,
  idField,
  moneyField,
  categoryField,
  booleanQuery,
  optionalText,
  validate,
} = require('./common.validator');

const nameField = z
  .string({ error: (issue) => (issue.input === undefined ? 'Name is required' : 'Name must be text') })
  .trim()
  .min(1, 'Name is required')
  .max(255, 'Name must be at most 255 characters');

const reorderLevelField = z
  .number({ error: 'Reorder level must be a number' })
  .int('Reorder level must be a whole number')
  .min(0, 'Reorder level cannot be negative')
  .max(100000, 'Reorder level is too large');

const listProductsSchema = z.object({
  category: categoryField.optional(),
  active: booleanQuery('active').optional(),
  search: optionalText('Search', 100),
  lowStock: booleanQuery('lowStock').optional(),
});

const barcodeLookupSchema = z.object({ barcode: barcodeField });

const registerProductSchema = z.object({
  barcode: barcodeField,
  name: nameField,
  category: categoryField,
  unitCost: moneyField('Unit cost'),
  reorderLevel: reorderLevelField.default(0),
});

const updateProductSchema = z
  .object({
    id: idField('Product id'),
    name: nameField.optional(),
    category: categoryField.optional(),
    unitCost: moneyField('Unit cost').optional(),
    reorderLevel: reorderLevelField.optional(),
    isActive: z.boolean({ error: 'isActive must be true or false' }).optional(),
  })
  .refine((data) => Object.keys(data).some((key) => key !== 'id' && data[key] !== undefined), {
    message: 'Nothing to update: send name, category, unitCost, reorderLevel or isActive',
    path: ['name'],
  });

const validateListProducts = (data) => validate(listProductsSchema, data);

const validateBarcodeLookup = (data) => validate(barcodeLookupSchema, data);

const validateRegisterProduct = (data) => validate(registerProductSchema, data);

const validateUpdateProduct = (data) => validate(updateProductSchema, data);

module.exports = { validateListProducts, validateBarcodeLookup, validateRegisterProduct, validateUpdateProduct };
