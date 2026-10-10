const db = require('../../config/database');

const IN_RANGE = 'm.created_at >= :from AND m.created_at < :to';

// Positive units / ₹ for one kind of movement inside the period. Out-movements are stored negative,
// so they are negated; a reversal row has the same type and the opposite sign, so it nets out.
const outUnits = (condition) => `COALESCE(-SUM(CASE WHEN ${IN_RANGE} AND ${condition} THEN m.qty END), 0)`;
const outValue = (condition) =>
  `COALESCE(-SUM(CASE WHEN ${IN_RANGE} AND ${condition} THEN m.qty * COALESCE(m.unit_cost, 0) END), 0)`;
const inUnits = (condition) => `COALESCE(SUM(CASE WHEN ${IN_RANGE} AND ${condition} THEN m.qty END), 0)`;
const inValue = (condition) =>
  `COALESCE(SUM(CASE WHEN ${IN_RANGE} AND ${condition} THEN m.qty * COALESCE(m.unit_cost, 0) END), 0)`;

const BOUGHT = "m.type IN ('opening', 'purchase')";
const MISSING = "m.type = 'count_adjustment' AND m.qty < 0";
const SURPLUS = "m.type = 'count_adjustment' AND m.qty > 0";

// One row per product for the period, in a single pass over the ledger.
const productSummary = async ({ from, to, category = null }) => {
  const [rows] = await db.query(
    {
      sql: `
        SELECT p.id AS productId, p.barcode, p.name, p.category, p.unit_cost AS unitCost,
               p.reorder_level AS reorderLevel, p.is_active AS isActive,
               COALESCE(SUM(CASE WHEN m.created_at < :from THEN m.qty END), 0) AS openingBalance,
               ${inUnits(BOUGHT)} AS bought,          ${inValue(BOUGHT)} AS boughtValue,
               ${outUnits("m.type = 'used'")} AS used,       ${outValue("m.type = 'used'")} AS usedValue,
               ${outUnits("m.type = 'sold'")} AS sold,       ${outValue("m.type = 'sold'")} AS soldValue,
               ${outUnits("m.type = 'damaged'")} AS damaged, ${outValue("m.type = 'damaged'")} AS damagedValue,
               ${outUnits(MISSING)} AS missing,       ${outValue(MISSING)} AS missingValue,
               ${inUnits(SURPLUS)} AS surplus,        ${inValue(SURPLUS)} AS surplusValue,
               COALESCE(SUM(CASE WHEN m.created_at < :to THEN m.qty END), 0) AS closingBalance,
               COALESCE(SUM(m.qty), 0) AS inStockNow
          FROM products p
          LEFT JOIN stock_movements m ON m.product_id = p.id
         WHERE (:category IS NULL OR p.category = :category)
         GROUP BY p.id
         ORDER BY p.name`,
      namedPlaceholders: true,
    },
    { from, to, category }
  );
  return rows;
};

// Units and ₹ per staff member per product for the period.
const staffProductUsage = async ({ from, to }) => {
  const [rows] = await db.query(
    {
      sql: `
        SELECT m.taken_by AS staffId, p.id AS productId, p.name AS productName, p.barcode, p.category,
               ${outUnits("m.type = 'used'")} AS used,       ${outValue("m.type = 'used'")} AS usedValue,
               ${outUnits("m.type = 'sold'")} AS sold,       ${outValue("m.type = 'sold'")} AS soldValue,
               ${outUnits("m.type = 'damaged'")} AS damaged, ${outValue("m.type = 'damaged'")} AS damagedValue
          FROM stock_movements m
          JOIN products p ON p.id = m.product_id
         WHERE ${IN_RANGE}
           AND m.taken_by IS NOT NULL
           AND m.type IN ('used', 'sold', 'damaged')
         GROUP BY m.taken_by, p.id
         ORDER BY p.name`,
      namedPlaceholders: true,
    },
    { from, to }
  );
  return rows;
};

module.exports = { productSummary, staffProductUsage };
