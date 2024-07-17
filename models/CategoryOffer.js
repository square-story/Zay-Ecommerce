// models/CategoryOffer.js

const mongoose = require('mongoose');

const categoryOfferSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'cetagory',
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

module.exports = mongoose.model('CategoryOffer', categoryOfferSchema);
