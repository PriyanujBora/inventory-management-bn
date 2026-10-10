const createError = require('http-errors');
const staffModel = require('../model/staff.model');
const { validateListStaff, validateCreateStaff, validateUpdateStaff } = require('../../util/staff.validator');

const listStaff = async (input) => {
  const { active } = validateListStaff(input);

  return staffModel.findAll({ active });
};

const assertNameFree = async (name, exceptId) => {
  const existing = await staffModel.findByName(name);
  if (existing && existing.id !== exceptId) {
    throw createError(409, `There is already a staff member called ${name}.`, { code: 'STAFF_NAME_TAKEN' });
  }
};

const createStaff = async (input) => {
  const { name, role } = validateCreateStaff(input);

  await assertNameFree(name);
  const id = await staffModel.create({ name, role });
  return staffModel.findById(id);
};

// Staff are deactivated, never deleted, so their history stays attributable.
const updateStaff = async (input) => {
  const { id, name, role, isActive } = validateUpdateStaff(input);

  const staff = await staffModel.findById(id);
  if (!staff) {
    throw createError(404, 'Staff member not found.', { code: 'STAFF_NOT_FOUND' });
  }
  if (name !== undefined) await assertNameFree(name, id);

  await staffModel.update(id, { name, role, isActive });
  return staffModel.findById(id);
};

// For services that record who took stock: the person must exist and still work here.
const getActiveStaff = async (id, connection) => {
  const staff = await staffModel.findById(id, connection);
  if (!staff) {
    throw createError(404, 'Staff member not found.', { code: 'STAFF_NOT_FOUND' });
  }
  if (!staff.isActive) {
    throw createError(409, `${staff.name} is marked inactive. Reactivate them on the Staff page first.`, {
      code: 'STAFF_INACTIVE',
    });
  }
  return staff;
};

module.exports = { listStaff, createStaff, updateStaff, getActiveStaff };
