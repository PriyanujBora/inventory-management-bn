const receiptService = require('../service/receipt.service');

const createReceipt = async (req, res) => {
  const { reference, supplier, isOpening, lines } = req.body ?? {};
  const receipt = await receiptService.createReceipt({ reference, supplier, isOpening, lines });
  res.status(201).json({ success: true, data: receipt });
};

const listReceipts = async (req, res) => {
  const { from, to } = req.query;
  const receipts = await receiptService.listReceipts({ from, to });
  res.json({ success: true, data: receipts });
};

const getReceipt = async (req, res) => {
  const receipt = await receiptService.getReceipt({ id: req.params.id });
  res.json({ success: true, data: receipt });
};

module.exports = { createReceipt, listReceipts, getReceipt };
