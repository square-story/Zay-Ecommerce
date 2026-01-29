import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  deliveryDetails: {
    type: Object,
    required: true,
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Product',
      },
      product: {
        type: String,
      },
      price: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
      },
      totalPrice: {
        type: Number,
        required: true,
      },
      size: {
        type: String,
      },
      status: {
        type: String,
        enum: [
          'pending',
          'placed',
          'outfordelivery',
          'shipped',
          'delivered',
          'canceled',
          'returned',
        ],
        default: 'placed',
      },
      cancelReason: {
        type: String,
      },
      cancelRequest: {
        type: String,
        enum: ['requested', 'accepted', 'denied'],
      },
      returnReason: {
        type: String,
      },
      returnRequest: {
        type: String,
        enum: ['requested', 'accepted', 'denied'],
      },
      coupon: {
        type: Number,
        default: 0,
      },
      offer: {
        type: Number,
      },
      date: {
        type: Date,
        default: Date.now(),
      },
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  discountedAmount: {
    type: Number, // Total discount applied to the order
    default: 0,
  },
  date: {
    type: Date,
    required: true,
  },
  expected_delivery: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: [
      'pending',
      'placed',
      'outfordelivery',
      'shipped',
      'delivered',
      'canceled',
      'returned',
      'failed',
    ], // Added "failed"
  },
  paymentMethod: {
    type: String,
    required: true,
  },
  paymentId: {
    type: String,
  },
  razorpayOrderId: {
    type: String, // Add this field to store Razorpay's order_id
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'], // Add this field to track payment status
    default: 'pending',
  },
  failureReason: {
    type: String, // Add this field to store the reason for payment failure
  },
  couponCode: {
    type: String, // Add this field to store the applied coupon code
  },
  couponMinimumAmount: { type: Number, default: 0 }, // New field
});

orderSchema.methods.getInvoiceDetails = function () {
  // Filter out products that are returned or canceled
  const validProducts = this.products.filter(
    (product) => product.status !== 'returned' && product.status !== 'canceled'
  );

  let subTotal = 0;
  let totalTax = 0;

  validProducts.forEach((product) => {
    // Assuming 18% tax included in price
    const unitPrice = product.price / 1.18;
    const taxAmount = (product.price - unitPrice) * product.quantity;

    subTotal += unitPrice * product.quantity;
    totalTax += taxAmount;
  });

  const discount = this.discountedAmount || 0;
  const totalAmount = subTotal + totalTax - discount;

  return {
    products: validProducts,
    subTotal,
    totalTax,
    discount,
    totalAmount,
    deliveryDetails: this.deliveryDetails,
    orderId: this._id,
    date: this.date,
    user: this.user,
  };
};

export default mongoose.model('Order', orderSchema);
