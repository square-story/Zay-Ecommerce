const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  adate: { type: Date, required: true },
  edate: { type: Date, required: true },
  damount: { type: Number, required: true },
  type: { type: String, enum: ['product', 'category'], required: true },
  applicableToProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  applicableToCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'cetagory' }]
});

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
