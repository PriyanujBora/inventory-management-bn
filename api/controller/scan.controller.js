const scanService = require('../service/scan.service');

const createScan = async (req, res) => {
  const { barcode, type } = req.body ?? {};
  const result = await scanService.scan({ barcode, type });
  res.status(201).json({ success: true, data: result });
};

const listScans = async (req, res) => {
  const { type, limit } = req.query;
  const scans = await scanService.listScans({ type, limit });
  res.json({ success: true, data: scans });
};

module.exports = { createScan, listScans };
