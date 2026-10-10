const productService = require('../service/product.service');

const listProducts = async (req, res) => {
  const { category, active, search, lowStock } = req.query;
  const products = await productService.listProducts({ category, active, search, lowStock });
  res.json({ success: true, data: products });
};

const getProductByBarcode = async (req, res) => {
  const product = await productService.getProductByBarcode({ barcode: req.params.barcode });
  res.json({ success: true, data: product });
};

const registerProduct = async (req, res) => {
  const { barcode, name, category, unitCost, reorderLevel } = req.body ?? {};
  const product = await productService.registerProduct({ barcode, name, category, unitCost, reorderLevel });
  res.status(201).json({ success: true, data: product });
};

const updateProduct = async (req, res) => {
  const { name, category, unitCost, reorderLevel, isActive } = req.body ?? {};
  const product = await productService.updateProduct({ id: req.params.id, name, category, unitCost, reorderLevel, isActive });
  res.json({ success: true, data: product });
};

module.exports = { listProducts, getProductByBarcode, registerProduct, updateProduct };
