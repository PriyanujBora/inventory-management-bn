const createError = require('http-errors');
const { withTransaction } = require('../../config/transaction');
const movementModel = require('../model/movement.model');
const productModel = require('../model/product.model');
const productService = require('./product.service');
const staffService = require('./staff.service');
const {
  validateRecordMovement,
  validateReverseMovement,
  validateUndoMovement,
  validateListMovements,
} = require('../../util/movement.validator');

// The Take Out screen offers Undo for 10 s; the server allows a little longer for slow networks.
const UNDO_WINDOW_SECONDS = 60;
const NEGATIVE_STOCK_NOTE = 'Recorded with insufficient stock';

const withReversalFlag = (movement) => ({ ...movement, isReversed: movement.reversedById !== null });

// Take Out: stock leaves the storeroom against a named staff member. The API gets a positive qty;
// the ledger stores it negative.
const recordMovement = async (input) => {
  const { barcode, type, qty, takenBy, note, confirmNegative } = validateRecordMovement(input);

  const movementId = await withTransaction(async (connection) => {
    const product = await productService.lockActiveProduct(connection, barcode);
    await staffService.getActiveStaff(takenBy, connection);

    // Physical reality wins over the system, but going below zero must be a deliberate choice.
    const inStock = await movementModel.stockOf(connection, product.id);
    const goesNegative = inStock - qty < 0;
    if (goesNegative && !confirmNegative) {
      throw createError(
        409,
        `Only ${inStock} × ${product.name} in stock, so taking ${qty} would go below zero. ` +
          'Record it anyway only if it really left the storeroom.',
        { code: 'INSUFFICIENT_STOCK' }
      );
    }

    return movementModel.insert(connection, {
      productId: product.id,
      type,
      qty: -qty,
      unitCost: product.unitCost,
      takenBy,
      note: goesNegative ? [NEGATIVE_STOCK_NOTE, note].filter(Boolean).join(': ') : note,
    });
  });

  const movement = await movementModel.findById(movementId);
  return { movement: withReversalFlag(movement), product: await productService.getProductById(movement.productId) };
};

// A reversal is a new row with the same type, the opposite qty and the same staff/cost,
// so per-type report sums net out on their own.
const reverse = ({ id, note }, { maxAgeSeconds } = {}) =>
  withTransaction(async (connection) => {
    const target = await movementModel.findById(id, connection);
    if (!target) {
      throw createError(404, 'Movement not found.', { code: 'MOVEMENT_NOT_FOUND' });
    }
    // Same lock order as every other stock change (product row first, then ledger rows),
    // so a reversal and a Take Out of the same product can't deadlock.
    await productModel.lockById(connection, target.productId);
    const original = await movementModel.lockById(connection, id);

    if (original.reversesId !== null) {
      throw createError(409, `This row is itself the undo of #${original.reversesId} and can't be reversed.`, {
        code: 'CANNOT_REVERSE_REVERSAL',
      });
    }
    if (original.type === 'count_adjustment') {
      throw createError(409, "Count adjustments can't be reversed. Do a new stock count to correct stock.", {
        code: 'CANNOT_REVERSE_COUNT',
      });
    }
    const existing = await movementModel.findReversalOf(connection, id);
    if (existing) {
      throw createError(409, `Movement #${id} was already reversed by #${existing.id}.`, { code: 'ALREADY_REVERSED' });
    }
    if (maxAgeSeconds !== undefined && original.ageSeconds > maxAgeSeconds) {
      throw createError(409, 'Too late to undo here. The owner can reverse it from History.', {
        code: 'UNDO_WINDOW_PASSED',
      });
    }

    return movementModel.insert(connection, {
      productId: original.productId,
      type: original.type,
      qty: -original.qty,
      unitCost: original.unitCost,
      takenBy: original.takenBy,
      reversesId: id,
      note,
    });
  });

const reversalResult = async (originalId, reversalId) => {
  const reversal = await movementModel.findById(reversalId);
  return {
    reversal: withReversalFlag(reversal),
    original: withReversalFlag(await movementModel.findById(originalId)),
    product: await productService.getProductById(reversal.productId),
  };
};

// Undo right after a scan (any operator).
const undoMovement = async (input) => {
  const { id, note } = validateUndoMovement(input);

  const reversalId = await reverse({ id, note }, { maxAgeSeconds: UNDO_WINDOW_SECONDS });
  return reversalResult(id, reversalId);
};

// Reverse at any time, with a reason (owner).
const reverseMovement = async (input) => {
  const { id, note } = validateReverseMovement(input);

  const reversalId = await reverse({ id, note });
  return reversalResult(id, reversalId);
};

const listMovements = async (input) => {
  const { from, to, productId, staffId, type, page, pageSize } = validateListMovements(input);

  const { rows, total } = await movementModel.findPage({
    from,
    to,
    productId,
    staffId,
    type,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { items: rows.map(withReversalFlag), page, pageSize, total };
};

module.exports = { recordMovement, undoMovement, reverseMovement, listMovements, withReversalFlag };
