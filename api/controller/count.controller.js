const countService = require('../service/count.service');

const listCounts = async (req, res) => {
  const counts = await countService.listCounts();
  res.json({ success: true, data: counts });
};

const getCurrentCount = async (req, res) => {
  const count = await countService.getCurrentCount();
  res.json({ success: true, data: count });
};

const startCount = async (req, res) => {
  const { note } = req.body ?? {};
  const count = await countService.startCount({ note });
  res.status(201).json({ success: true, data: count });
};

const scanIntoCount = async (req, res) => {
  const { barcode } = req.body ?? {};
  const line = await countService.scanIntoCount({ id: req.params.id, barcode });
  res.json({ success: true, data: line });
};

const setCountLine = async (req, res) => {
  const { countedQty } = req.body ?? {};
  const line = await countService.setCountLine({ id: req.params.id, productId: req.params.productId, countedQty });
  res.json({ success: true, data: line });
};

const previewCount = async (req, res) => {
  const preview = await countService.previewCount({ id: req.params.id });
  res.json({ success: true, data: preview });
};

const closeCount = async (req, res) => {
  const count = await countService.closeCount({ id: req.params.id });
  res.json({ success: true, data: count });
};

const cancelCount = async (req, res) => {
  const count = await countService.cancelCount({ id: req.params.id });
  res.json({ success: true, data: count });
};

const getCount = async (req, res) => {
  const count = await countService.getCount({ id: req.params.id });
  res.json({ success: true, data: count });
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
