const mongoose = require('mongoose');
const GroceryProduct = require('../../src/models/GroceryProduct.model');

describe('GroceryProduct schema', () => {
  it('rejects products with zero variants', async () => {
    const p = new GroceryProduct({
      name: 'Atta', image: 'x.jpg', category: new mongoose.Types.ObjectId(),
      variants: []
    });
    await expect(p.validate()).rejects.toThrow(/variant/i);
  });

  it('rejects variant with sellingPrice > mrp', async () => {
    const p = new GroceryProduct({
      name: 'Atta', image: 'x.jpg', category: new mongoose.Types.ObjectId(),
      variants: [{ label: '1kg', mrp: 50, sellingPrice: 55 }]
    });
    await expect(p.validate()).rejects.toThrow(/sellingPrice/i);
  });

  it('accepts valid product with one variant', async () => {
    const p = new GroceryProduct({
      name: 'Atta', image: 'x.jpg', category: new mongoose.Types.ObjectId(),
      variants: [{ label: '1kg', mrp: 55, sellingPrice: 52 }]
    });
    await expect(p.validate()).resolves.toBeUndefined();
  });
});
