const { Router } = require('express');
const scanController = require('../controller/scan.controller');

const router = Router();

router.get('/', scanController.listScans);
router.post('/', scanController.createScan);

module.exports = router;
