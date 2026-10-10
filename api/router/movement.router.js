const { Router } = require('express');
const movementController = require('../controller/movement.controller');
const { requireOwner } = require('../../middleware/auth.middleware');

const router = Router();

router.get('/', movementController.listMovements);
router.post('/', movementController.recordMovement);
// Undo straight after a scan; the service rejects it once the undo window has passed.
router.post('/:id/undo', movementController.undoMovement);

// Owner only: reversing a movement outside the undo window. TODO(auth)
router.post('/:id/reverse', requireOwner, movementController.reverseMovement);

module.exports = router;
