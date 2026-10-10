const { z } = require('zod');
const { STAFF_ROLES, idField, booleanQuery, validate } = require('./common.validator');

const nameField = z
  .string({ error: (issue) => (issue.input === undefined ? 'Name is required' : 'Name must be text') })
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');

const roleField = z.enum(STAFF_ROLES, { error: 'Role must be owner, manager, stylist or other' });

const listStaffSchema = z.object({
  active: booleanQuery('active').optional(),
});

const createStaffSchema = z.object({
  name: nameField,
  role: roleField.default('stylist'),
});

const updateStaffSchema = z
  .object({
    id: idField('Staff id'),
    name: nameField.optional(),
    role: roleField.optional(),
    isActive: z.boolean({ error: 'isActive must be true or false' }).optional(),
  })
  .refine((data) => data.name !== undefined || data.role !== undefined || data.isActive !== undefined, {
    message: 'Nothing to update: send name, role or isActive',
    path: ['name'],
  });

const validateListStaff = (data) => validate(listStaffSchema, data);

const validateCreateStaff = (data) => validate(createStaffSchema, data);

const validateUpdateStaff = (data) => validate(updateStaffSchema, data);

module.exports = { validateListStaff, validateCreateStaff, validateUpdateStaff };
