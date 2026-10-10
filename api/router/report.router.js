const { Router } = require('express');
const reportController = require('../controller/report.controller');

const router = Router();

router.get('/summary', reportController.getSummary);
router.get('/by-staff', reportController.getStaffUsage);
router.get('/low-stock', reportController.getLowStock);

module.exports = router;
