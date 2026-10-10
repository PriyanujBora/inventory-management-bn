const { Router } = require('express');
const countController = require('../controller/count.controller');
const { requireOwner } = require('../../middleware/auth.middleware');

const router = Router();

router.get('/', countController.listCounts);
router.get('/current', countController.getCurrentCount);
router.post('/', countController.startCount);
router.post('/:id/scan', countController.scanIntoCount);
router.put('/:id/lines/:productId', countController.setCountLine);
router.get('/:id/preview', countController.previewCount);
router.get('/:id', countController.getCount);

// Owner only: closing a count writes the stock adjustments; cancelling throws the count away. TODO(auth)
router.post('/:id/close', requireOwner, countController.closeCount);
router.post('/:id/cancel', requireOwner, countController.cancelCount);

module.exports = router;
