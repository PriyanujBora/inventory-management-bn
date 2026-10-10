const reportService = require('../service/report.service');

const getSummary = async (req, res) => {
  const { from, to, category } = req.query;
  const summary = await reportService.getSummary({ from, to, category });
  res.json({ success: true, data: summary });
};

const getStaffUsage = async (req, res) => {
  const { from, to } = req.query;
  const usage = await reportService.getStaffUsage({ from, to });
  res.json({ success: true, data: usage });
};

const getLowStock = async (req, res) => {
  const products = await reportService.getLowStock();
  res.json({ success: true, data: products });
};

module.exports = { getSummary, getStaffUsage, getLowStock };
