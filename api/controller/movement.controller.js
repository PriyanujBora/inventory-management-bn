const movementService = require('../service/movement.service');

const recordMovement = async (req, res) => {
  const { barcode, type, qty, takenBy, note, confirmNegative } = req.body ?? {};
  const result = await movementService.recordMovement({ barcode, type, qty, takenBy, note, confirmNegative });
  res.status(201).json({ success: true, data: result });
};

const undoMovement = async (req, res) => {
  const { note } = req.body ?? {};
  const result = await movementService.undoMovement({ id: req.params.id, note });
  res.status(201).json({ success: true, data: result });
};

const reverseMovement = async (req, res) => {
  const { note } = req.body ?? {};
  const result = await movementService.reverseMovement({ id: req.params.id, note });
  res.status(201).json({ success: true, data: result });
};

const listMovements = async (req, res) => {
  const { from, to, productId, staffId, type, page, pageSize } = req.query;
  const result = await movementService.listMovements({ from, to, productId, staffId, type, page, pageSize });
  res.json({ success: true, data: result });
};

module.exports = { recordMovement, undoMovement, reverseMovement, listMovements };
