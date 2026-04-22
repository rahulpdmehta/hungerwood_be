const mongoose = require('mongoose');

const grocerySettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'grocery-settings' },
  isOpen: { type: Boolean, default: false, required: true },
  closingMessage: { type: String, default: '', maxlength: 200 },
  taxRate: { type: Number, default: 0.05, min: 0, max: 1 },
  deliveryFee: { type: Number, default: 40, min: 0 },
  freeDeliveryThreshold: { type: Number, default: null, min: 0 },
  minOrderValue: { type: Number, default: null, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true, _id: false });

grocerySettingsSchema.statics.get = async function () {
  let doc = await this.findById('grocery-settings');
  if (!doc) doc = await this.create({ _id: 'grocery-settings' });
  return doc;
};

module.exports = mongoose.model('GrocerySettings', grocerySettingsSchema);
