const { Router } = require('express');
const staffController = require('../controller/staff.controller');
const { requireOwner } = require('../../middleware/auth.middleware');

const router = Router();

router.get('/', staffController.listStaff);

// Owner only: managing staff. TODO(auth)
router.post('/', requireOwner, staffController.createStaff);
router.patch('/:id', requireOwner, staffController.updateStaff);

module.exports = router;
