const { Router } = require('express');
const productController = require('../controller/product.controller');
const { requireOwner } = require('../../middleware/auth.middleware');

const router = Router();

router.get('/', productController.listProducts);
router.get('/barcode/:barcode', productController.getProductByBarcode);
// Registering happens during Stock In, so any operator may do it.
router.post('/', productController.registerProduct);

// Owner only: editing or deactivating products. TODO(auth)
router.patch('/:id', requireOwner, productController.updateProduct);

module.exports = router;
