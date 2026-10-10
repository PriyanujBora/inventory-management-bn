const createError = require('http-errors');
const productModel = require('../model/product.model');
const scanModel = require('../model/scan.model');
const {
  validateRegisterProduct,
  validateListProducts,
  validateRenameProduct,
} = require('../../util/product.validator');

// The first scan of a new barcode registers it and puts it IN the inventory.
const FIRST_SCAN_STATUS = 'in';

const registerProduct = async (input) => {
  const { barcode, name, type } = validateRegisterProduct(input);

  const existing = await productModel.findByBarcode(barcode);
  if (existing) {
    throw createError(409, `Barcode ${barcode} is already registered.`, { code: 'ALREADY_REGISTERED' });
  }

  const productId = await scanModel.createProductWithFirstScan({
    barcode,
    name,
    type,
    status: FIRST_SCAN_STATUS,
  });

  return { action: FIRST_SCAN_STATUS, isNew: true, product: await productModel.findById(productId) };
};

const listProducts = async (input) => {
  const { type, status } = validateListProducts(input);

  return productModel.findAll({ type, status });
};

const renameProduct = async (input) => {
  const { id, name } = validateRenameProduct(input);

  const product = await productModel.findById(id);
  if (!product) {
    throw createError(404, 'Product not found.', { code: 'PRODUCT_NOT_FOUND' });
  }

  await productModel.updateName(id, name);
  return productModel.findById(id);
};

module.exports = { registerProduct, listProducts, renameProduct };
