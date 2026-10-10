const { z } = require('zod');
const { categoryField, dateRangeShape, rangeIsOrdered, RANGE_ORDER_ERROR, validate } = require('./common.validator');

// Reports always cover a period: [from, to), sent as ISO timestamps computed from local dates.
const summarySchema = z
  .object({ ...dateRangeShape(true), category: categoryField.optional() })
  .refine(rangeIsOrdered, RANGE_ORDER_ERROR);

const byStaffSchema = z.object({ ...dateRangeShape(true) }).refine(rangeIsOrdered, RANGE_ORDER_ERROR);

const validateSummary = (data) => validate(summarySchema, data);

const validateByStaff = (data) => validate(byStaffSchema, data);

module.exports = { validateSummary, validateByStaff };
