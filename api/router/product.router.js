const { Router } = require('express');
const productController = require('../controller/product.controller');

const router = Router();

router.get('/', productController.listProducts);
router.post('/', productController.registerProduct);
router.patch('/:id', productController.renameProduct);

module.exports = router;
