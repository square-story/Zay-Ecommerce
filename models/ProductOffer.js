// models/ProductOffer.js

const mongoose = require('mongoose');

const productOfferSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  discountPercentage: {
    type: Number,
    required: true,
  },
  validFrom: {
    type: Date,
    required: true,
  },
  validUntil: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model('ProductOffer', productOfferSchema);
