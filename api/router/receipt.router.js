const { Router } = require('express');
const receiptController = require('../controller/receipt.controller');

const router = Router();

router.get('/', receiptController.listReceipts);
router.post('/', receiptController.createReceipt);
router.get('/:id', receiptController.getReceipt);

module.exports = router;
