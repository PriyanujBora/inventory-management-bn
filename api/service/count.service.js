const createError = require('http-errors');
const { withTransaction } = require('../../config/transaction');
const countModel = require('../model/count.model');
const movementModel = require('../model/movement.model');
const productModel = require('../model/product.model');
const productService = require('./product.service');
const {
  validateStartCount,
  validateCountId,
  validateCountScan,
  validateSetCountLine,
} = require('../../util/count.validator');

const roundMoney = (value) => Math.round(value * 100) / 100;

// Missing = counted below expected (negative difference); surplus = counted above expected.
const summarise = (rows) => {
  const totals = {
    missingProducts: 0,
    missingUnits: 0,
    missingValue: 0,
    surplusProducts: 0,
    surplusUnits: 0,
    surplusValue: 0,
  };
  for (const { difference, differenceValue } of rows) {
    if (difference < 0) {
      totals.missingProducts += 1;
      totals.missingUnits -= difference;
      totals.missingValue -= differenceValue;
    } else if (difference > 0) {
      totals.surplusProducts += 1;
      totals.surplusUnits += difference;
      totals.surplusValue += differenceValue;
    }
  }
  totals.missingValue = roundMoney(totals.missingValue);
  totals.surplusValue = roundMoney(totals.surplusValue);
  return totals;
};

const withDifference = (row) => {
  const difference = row.counted - row.expected;
  return { ...row, difference, differenceValue: roundMoney(difference * (row.unitCost ?? 0)) };
};

const getCountOrThrow = async (id) => {
  const count = await countModel.findById(id);
  if (!count) {
    throw createError(404, 'Stock count not found.', { code: 'COUNT_NOT_FOUND' });
  }
  return count;
};

// Locks the count row; everything that changes a count goes through here first.
const lockOpenCount = async (connection, id) => {
  const count = await countModel.lockById(connection, id);
  if (!count) {
    throw createError(404, 'Stock count not found.', { code: 'COUNT_NOT_FOUND' });
  }
  if (count.status !== 'open') {
    throw createError(409, `Stock count #${id} is already ${count.status}.`, { code: 'COUNT_NOT_OPEN' });
  }
  return count;
};

const listCounts = async () => countModel.findAll();

// The open count with what has been counted so far (no expected quantities), or null.
const getCurrentCount = async () => {
  const count = await countModel.findOpen();
  if (!count) return null;
  return { ...count, lines: await countModel.findLines(count.id) };
};

const startCount = async (input) => {
  const { note } = validateStartCount(input);

  const id = await withTransaction(async (connection) => {
    const open = await countModel.lockOpen(connection);
    if (open) {
      throw createError(409, `Stock count #${open.id} is still open. Close or cancel it before starting another.`, {
        code: 'COUNT_ALREADY_OPEN',
      });
    }
    return countModel.create(connection, { note });
  });

  return getCountById(id);
};

// Each scan adds one unit and is saved immediately, so a refresh or crash loses nothing.
const scanIntoCount = async (input) => {
  const { id, barcode } = validateCountScan(input);

  return withTransaction(async (connection) => {
    await lockOpenCount(connection, id);
    const product = await productService.lockActiveProduct(connection, barcode);
    await countModel.incrementLine(connection, id, product.id);
    return countModel.findLine(id, product.id, connection);
  });
};

// Sets a line directly, e.g. after counting 12 tubes by hand. 0 is allowed.
const setCountLine = async (input) => {
  const { id, productId, countedQty } = validateSetCountLine(input);

  return withTransaction(async (connection) => {
    await lockOpenCount(connection, id);
    const product = await productModel.findById(productId, connection);
    if (!product) {
      throw createError(404, 'Product not found.', { code: 'PRODUCT_NOT_FOUND' });
    }
    await countModel.setLine(connection, id, productId, countedQty);
    return countModel.findLine(id, productId, connection);
  });
};

const previewCount = async (input) => {
  const { id } = validateCountId(input);

  const count = await getCountOrThrow(id);
  if (count.status !== 'open') {
    throw createError(409, `Stock count #${id} is ${count.status}; open its results instead.`, { code: 'COUNT_NOT_OPEN' });
  }

  const rows = (await countModel.findExpectedVsCounted(id)).map(withDifference);
  return { count, rows, totals: summarise(rows) };
};

// Closing writes one count_adjustment per product whose counted stock differs from the ledger.
const closeCount = async (input) => {
  const { id } = validateCountId(input);

  await withTransaction(async (connection) => {
    await lockOpenCount(connection, id);
    // Every stock change locks its product row first, so holding them all freezes stock while we close.
    await productModel.lockActive(connection);

    const rows = await countModel.findExpectedVsCounted(id, connection);
    for (const { productId, expected, counted, unitCost } of rows) {
      await countModel.saveExpected(connection, id, productId, counted, expected);
      if (counted !== expected) {
        await movementModel.insert(connection, {
          productId,
          type: 'count_adjustment',
          qty: counted - expected,
          unitCost,
          countId: id,
        });
      }
    }

    await countModel.setStatus(connection, id, 'closed');
  });

  return getCountById(id);
};

// Cancelling keeps the lines for the record but writes no movements.
const cancelCount = async (input) => {
  const { id } = validateCountId(input);

  await withTransaction(async (connection) => {
    await lockOpenCount(connection, id);
    await countModel.setStatus(connection, id, 'cancelled');
  });

  return getCountById(id);
};

const getCountById = async (id) => {
  const count = await getCountOrThrow(id);

  if (count.status === 'closed') {
    const results = await countModel.findResults(id);
    return { ...count, results, totals: summarise(results) };
  }
  return { ...count, lines: await countModel.findLines(id) };
};

const getCount = async (input) => {
  const { id } = validateCountId(input);

  return getCountById(id);
};

module.exports = {
  listCounts,
  getCurrentCount,
  startCount,
  scanIntoCount,
  setCountLine,
  previewCount,
  closeCount,
  cancelCount,
  getCount,
};
