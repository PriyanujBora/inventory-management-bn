const reportModel = require('../model/report.model');
const productModel = require('../model/product.model');
const staffModel = require('../model/staff.model');
const countModel = require('../model/count.model');
const { withLowStockFlag } = require('./product.service');
const { validateSummary, validateByStaff } = require('../../util/report.validator');

const roundMoney = (value) => Math.round(value * 100) / 100;

const TOTAL_KEYS = ['bought', 'used', 'sold', 'damaged', 'missing', 'surplus'];
const USAGE_KEYS = ['used', 'sold', 'damaged'];

// Adds `<key>` units and `<key>Value` ₹ across rows.
const sumColumns = (rows, keys) => {
  const totals = {};
  for (const key of keys) {
    totals[key] = rows.reduce((sum, row) => sum + row[key], 0);
    totals[`${key}Value`] = roundMoney(rows.reduce((sum, row) => sum + row[`${key}Value`], 0));
  }
  return totals;
};

const isIdle = (row) =>
  row.openingBalance === 0 && row.closingBalance === 0 && row.inStockNow === 0 && TOTAL_KEYS.every((key) => row[key] === 0);

// Per product for [from, to): opening balance, bought, used, sold, damaged, missing, surplus,
// closing balance, plus ₹ figures from each movement's own cost snapshot.
const getSummary = async (input) => {
  const { from, to, category } = validateSummary(input);

  const rows = (await reportModel.productSummary({ from, to, category }))
    // Deactivated products with nothing to report are noise.
    .filter((row) => row.isActive || !isIdle(row))
    .map((row) => ({ ...row, isLowStock: row.isActive && row.inStockNow <= row.reorderLevel }));

  const lastClosed = await countModel.findLastClosed();

  return {
    from,
    to,
    rows,
    totals: { ...sumColumns(rows, TOTAL_KEYS), lowStockCount: rows.filter((row) => row.isLowStock).length },
    // Missing stock is only known once a count has been closed.
    lastCountClosedAt: lastClosed?.closedAt ?? null,
  };
};

// Per staff member: what they took out (used / sold / damaged) in units and ₹, with a per-product breakdown.
const getStaffUsage = async (input) => {
  const { from, to } = validateByStaff(input);

  const [usage, staff] = await Promise.all([reportModel.staffProductUsage({ from, to }), staffModel.findAll()]);

  const rows = staff
    .map((member) => {
      const products = usage.filter((row) => row.staffId === member.id);
      const totals = sumColumns(products, USAGE_KEYS);
      return {
        staffId: member.id,
        name: member.name,
        role: member.role,
        isActive: member.isActive,
        ...totals,
        totalUnits: totals.used + totals.sold + totals.damaged,
        totalValue: roundMoney(totals.usedValue + totals.soldValue + totals.damagedValue),
        products: products.map(({ staffId, ...product }) => product),
      };
    })
    // Former staff only appear if they took something in this period.
    .filter((row) => row.isActive || row.products.length > 0)
    .sort((a, b) => b.totalValue - a.totalValue || a.name.localeCompare(b.name));

  return { from, to, rows, totals: sumColumns(rows, USAGE_KEYS) };
};

const getLowStock = async () => {
  const products = await productModel.findAll({ active: true, lowStock: true });
  return products.map(withLowStockFlag);
};

module.exports = { getSummary, getStaffUsage, getLowStock };
