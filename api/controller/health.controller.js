const healthService = require('../service/health.service');

const getHealth = async (req, res) => {
  const health = await healthService.checkHealth();
  res.json({ success: true, data: health });
};

module.exports = { getHealth };
