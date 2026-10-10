const createError = require('http-errors');
const productModel = require('../model/product.model');
const scanModel = require('../model/scan.model');
const { validateScan, validateListScans } = require('../../util/scan.validator');

const TYPE_LABELS = { consumable: 'Consumable', sellable: 'Sellable' };

// Every scan of a registered barcode flips it: IN -> OUT -> IN -> ...
const scan = async (input) => {
  const { barcode, type } = validateScan(input);

  const product = await productModel.findByBarcode(barcode);
  if (!product) {
    throw createError(404, `Barcode ${barcode} is not registered yet.`, { code: 'NOT_REGISTERED' });
  }

  // The scan screen's switch must match the product's type, so consumables and sellables never get mixed up.
  if (product.type !== type) {
    const label = TYPE_LABELS[product.type];
    throw createError(409, `This product is a ${label}. Switch to ${label} to scan it.`, {
      code: 'TYPE_MISMATCH',
    });
  }

  const nextStatus = product.status === 'in' ? 'out' : 'in';
  const toggled = await scanModel.toggleStatusWithScan({
    productId: product.id,
    fromStatus: product.status,
    toStatus: nextStatus,
  });
  if (!toggled) {
    throw createError(409, 'This product was just scanned somewhere else. Please scan it again.', {
      code: 'SCAN_CONFLICT',
    });
  }

  return { action: nextStatus, isNew: false, product: await productModel.findById(product.id) };
};

const listScans = async (input) => {
  const { type, limit } = validateListScans(input);

  return scanModel.findRecent({ type, limit });
};

module.exports = { scan, listScans };
