const createError = require('http-errors');
const productModel = require('../model/product.model');
const {
  validateListProducts,
  validateBarcodeLookup,
  validateRegisterProduct,
  validateUpdateProduct,
} = require('../../util/product.validator');

const NOT_REGISTERED_MESSAGE = 'Not registered yet. Add it through Stock In.';

// A product needs reordering once stock falls to its reorder level.
const withLowStockFlag = (product) => ({ ...product, isLowStock: product.inStock <= product.reorderLevel });

const listProducts = async (input) => {
  const { category, active, search, lowStock } = validateListProducts(input);

  const products = await productModel.findAll({ category, active, search, lowStock: lowStock || null });
  return products.map(withLowStockFlag);
};

const getProductByBarcode = async (input) => {
  const { barcode } = validateBarcodeLookup(input);

  const product = await productModel.findByBarcode(barcode);
  if (!product) {
    throw createError(404, NOT_REGISTERED_MESSAGE, { code: 'NOT_REGISTERED' });
  }
  return withLowStockFlag(product);
};

const getProductById = async (id) => {
  const product = await productModel.findById(id);
  return product && withLowStockFlag(product);
};

// Only Stock In registers products, so name, category and cost are always known.
const registerProduct = async (input) => {
  const { barcode, name, category, unitCost, reorderLevel } = validateRegisterProduct(input);

  const existing = await productModel.findByBarcode(barcode);
  if (existing) {
    throw createError(409, `Barcode ${barcode} is already registered as ${existing.name}.`, {
      code: 'ALREADY_REGISTERED',
    });
  }

  const id = await productModel.create({ barcode, name, category, unitCost, reorderLevel });
  return getProductById(id);
};

const updateProduct = async (input) => {
  const { id, ...fields } = validateUpdateProduct(input);

  const product = await productModel.findById(id);
  if (!product) {
    throw createError(404, 'Product not found.', { code: 'PRODUCT_NOT_FOUND' });
  }

  await productModel.update(id, fields);
  return getProductById(id);
};

// For services that move stock: locks the product row for the rest of the transaction.
// Unknown barcodes -> 404 NOT_REGISTERED; deactivated products -> 409 PRODUCT_INACTIVE.
const lockActiveProduct = async (connection, barcode, { notRegisteredMessage = NOT_REGISTERED_MESSAGE } = {}) => {
  const product = await productModel.lockByBarcode(connection, barcode);
  if (!product) {
    throw createError(404, notRegisteredMessage, { code: 'NOT_REGISTERED' });
  }
  if (!product.isActive) {
    throw createError(409, `${product.name} is marked inactive. Reactivate it on the Products page first.`, {
      code: 'PRODUCT_INACTIVE',
    });
  }
  return product;
};

module.exports = {
  listProducts,
  getProductByBarcode,
  getProductById,
  registerProduct,
  updateProduct,
  lockActiveProduct,
  withLowStockFlag,
};
