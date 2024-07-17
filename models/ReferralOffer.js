// models/ReferralOffer.js

const mongoose = require('mongoose');

const referralOfferSchema = new mongoose.Schema({
  referralCode: {
    type: String,
    unique: true,
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

module.exports = mongoose.model('ReferralOffer', referralOfferSchema);
