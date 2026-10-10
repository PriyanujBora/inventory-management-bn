const productService = require('../service/product.service');

const registerProduct = async (req, res) => {
  const { barcode, name, type } = req.body ?? {};
  const result = await productService.registerProduct({ barcode, name, type });
  res.status(201).json({ success: true, data: result });
};

const listProducts = async (req, res) => {
  const { type, status } = req.query;
  const products = await productService.listProducts({ type, status });
  res.json({ success: true, data: products });
};

const renameProduct = async (req, res) => {
  const { name } = req.body ?? {};
  const product = await productService.renameProduct({ id: req.params.id, name });
  res.json({ success: true, data: product });
};

module.exports = { registerProduct, listProducts, renameProduct };
