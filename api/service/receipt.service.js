const createError = require('http-errors');
const { withTransaction } = require('../../config/transaction');
const receiptModel = require('../model/receipt.model');
const movementModel = require('../model/movement.model');
const productModel = require('../model/product.model');
const productService = require('./product.service');
const { withReversalFlag } = require('./movement.service');
const { MAX_QTY } = require('../../util/common.validator');
const { validateCreateReceipt, validateListReceipts, validateReceiptId } = require('../../util/receipt.validator');

// The same product scanned on several lines becomes one line: quantities add up and
// the last cost entered wins. Sorted by barcode so concurrent receipts lock rows in the same order.
const mergeLines = (lines) => {
  const byBarcode = new Map();
  for (const { barcode, qty, unitCost } of lines) {
    const line = byBarcode.get(barcode) ?? { barcode, qty: 0, unitCost: undefined };
    line.qty += qty;
    if (unitCost !== undefined) line.unitCost = unitCost;
    byBarcode.set(barcode, line);
  }
  return [...byBarcode.values()].sort((a, b) => a.barcode.localeCompare(b.barcode));
};

// One delivery = one receipt row + one purchase (or opening) movement per product, all or nothing.
const createReceipt = async (input) => {
  const { reference, supplier, isOpening, lines } = validateCreateReceipt(input);

  const mergedLines = mergeLines(lines);
  const tooLarge = mergedLines.find((line) => line.qty > MAX_QTY);
  if (tooLarge) {
    throw createError(400, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details: [{ field: 'lines', message: `Barcode ${tooLarge.barcode} adds up to more than ${MAX_QTY} units` }],
    });
  }

  const type = isOpening ? 'opening' : 'purchase';

  const receiptId = await withTransaction(async (connection) => {
    const id = await receiptModel.create(connection, { reference, supplier, isOpening });

    for (const line of mergedLines) {
      const product = await productService.lockActiveProduct(connection, line.barcode, {
        notRegisteredMessage: `Barcode ${line.barcode} is not registered yet. Register it before saving the receipt.`,
      });

      // A cost entered on the delivery becomes the product's current cost; otherwise snapshot the current one.
      if (line.unitCost !== undefined && line.unitCost !== product.unitCost) {
        await productModel.updateUnitCost(connection, product.id, line.unitCost);
      }

      await movementModel.insert(connection, {
        productId: product.id,
        type,
        qty: line.qty,
        unitCost: line.unitCost ?? product.unitCost,
        receiptId: id,
      });
    }

    return id;
  });

  return getReceiptById(receiptId);
};

const getReceiptById = async (id) => {
  const receipt = await receiptModel.findById(id);
  if (!receipt) {
    throw createError(404, 'Receipt not found.', { code: 'RECEIPT_NOT_FOUND' });
  }
  const movements = await movementModel.findByReceipt(id);
  return { ...receipt, movements: movements.map(withReversalFlag) };
};

const getReceipt = async (input) => {
  const { id } = validateReceiptId(input);

  return getReceiptById(id);
};

const listReceipts = async (input) => {
  const { from, to } = validateListReceipts(input);

  return receiptModel.findAll({ from, to });
};

module.exports = { createReceipt, getReceipt, listReceipts };
