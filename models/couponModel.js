import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  name: String,
  couponCode: String,
  activationDate: { type: Date, required: true },
  expiresDate: { type: Date, required: true },
  percentage: Number,
  maxDiscountAmount: Number,
  limit: Number,
  minimumOrderValue: Number,
  userUsed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

export default mongoose.model('Coupon', couponSchema);
