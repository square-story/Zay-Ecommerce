import mongoose from 'mongoose';

const wishlistSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      index: {
        type: String,
        required: true,
      },
    },
  ],
});

export default mongoose.model('Wishlist', wishlistSchema);
