const staffService = require('../service/staff.service');

const listStaff = async (req, res) => {
  const { active } = req.query;
  const staff = await staffService.listStaff({ active });
  res.json({ success: true, data: staff });
};

const createStaff = async (req, res) => {
  const { name, role } = req.body ?? {};
  const staff = await staffService.createStaff({ name, role });
  res.status(201).json({ success: true, data: staff });
};

const updateStaff = async (req, res) => {
  const { name, role, isActive } = req.body ?? {};
  const staff = await staffService.updateStaff({ id: req.params.id, name, role, isActive });
  res.json({ success: true, data: staff });
};

module.exports = { listStaff, createStaff, updateStaff };
