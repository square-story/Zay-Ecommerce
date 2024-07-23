const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  name: String,
  adate: String,
  edate: String,
  limit: Number,
  damount: Number,
  type: { type: String, enum: ['product', 'category'], required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: function() { return this.type === 'product'; }},
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'cetagory', required: function() { return this.type === 'category'; }}
});

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
