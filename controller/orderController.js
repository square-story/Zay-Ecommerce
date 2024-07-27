const Address = require("../models/address");
const Cart = require("../models/cartModel");
const Order = require("../models/order");
const Product = require("../models/product");
const Review = require("../models/reviewModal");
const Wallet = require("../models/walletModel");
const Coupon = require("../models/couponModel");
const { updateWallet } = require("./walletController");
const Razorpay = require("razorpay");

const crypto = require("crypto");
const order = require("../models/order");
require("dotenv").config();

// Initialize Razorpay instance with your key ID and key secret
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports.loadMyOrder = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = 4; // Set the limit of orders per page
    const userid = req.session.user?._id;
    const wallet = await Wallet.findOne({ user: userid });
    const walletBalance = wallet ? wallet.balance : 0;
    if (!userid) {
      return res.redirect("/login"); // Redirect to login if the user is not logged in
    }

    const orderLength = await Order.countDocuments({ user: userid });
    const orders = await Order.find({
      user: userid,
      status: { $nin: ["pending"] },
    })
      .populate("user")
      .sort({ date: -1 }) // Ensure orders are sorted by creation date
      .skip(page * limit)
      .limit(limit);

    res.render("myOrder", {
      orders, // Use a consistent naming convention (orders instead of order)
      page,
      limit, // Pass the limit to the template
      orderLength,
      walletBalance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

module.exports.addAddress = async (req, res) => {
  try {
    console.log(req.body);
    const userid = req.session.user?._id;

    if (userid) {
      const fullname = req.body.fname + " " + req.body.lname;

      const userAddress = {
        fullName: fullname,
        country: req.body.country,
        address: req.body.address,
        state: req.body.state,
        city: req.body.city,
        pincode: req.body.pin,
        phone: req.body.phone,
        email: req.body.email,
      };

      const ad = await Address.findOne({ user: userid });

      if (ad) {
        await Address.updateOne(
          { user: userid },
          {
            $push: {
              address: userAddress,
            },
          }
        );
      } else {
        const address = new Address({
          user: userid,
          address: userAddress,
        });

        await address.save();
      }

      req.body.account
        ? res.redirect("/manage-address")
        : res.redirect("/check-out");
    } else {
      console.log("id didt recived");
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports.placeOrder = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.status(400).json({ error: "User not logged in" });
    }

    const { index, payment_method, subtotal: subtotalStr, isCoupon } = req.body;
    const subtotal = parseFloat(subtotalStr);
    if (isNaN(subtotal)) {
      return res.status(400).json({ error: "Invalid subtotal value" });
    }

    let cart = await Cart.findOne({ user: userId }).populate(
      "products.productId"
    );
    if (!cart) {
      return res.status(400).json({ error: "Cart not found for user" });
    }
    const products = cart.products;

    const addresses = await Address.findOne({ user: userId }, { address: 1 });
    if (!addresses) {
      return res.status(400).json({ error: "No addresses found for user" });
    }

    const selectedAddress = addresses.address[index];
    if (!selectedAddress) {
      return res.status(400).json({ error: "Address not found" });
    }

    // Check stock availability for each product variant in the cart
    const outOfStockProducts = [];
    for (let product of products) {
      const variantIndex = product.product;
      if (!variantIndex || variantIndex >= product.productId.variant.length) {
        return res.status(400).json({ error: "Invalid product variant index" });
      }
      const productVariant = product.productId.variant[variantIndex];
      const requestedQuantity = product.quantity;
      console.log(productVariant);
      if (
        !productVariant ||
        !productVariant.stock ||
        productVariant.stock < requestedQuantity
      ) {
        outOfStockProducts.push({
          productName: product.productId.name,
          variantDetails: productVariant,
        });
      }
    }
    if (outOfStockProducts.length > 0) {
      return res
        .status(400)
        .json({ error: "Some products are out of stock", outOfStockProducts });
    }

    let deliveryCharge = subtotal < 500 ? 80 : 0;
    let discount = 0;
    let couponCode = null;

    // Apply coupon if available
    if (isCoupon) {
      const coupon = await Coupon.findOne({ couponCode: isCoupon });
      if (coupon && coupon.limit >= coupon.userUsed.length) {
        discount = coupon.discountAmount || 0;
        coupon.userUsed.push(userId);
        await coupon.save();

        const discountPerProduct = discount / products.length;
        for (let product of products) {
          const { totalPrice } = product;
          const productDiscount = Math.min(totalPrice, discountPerProduct);
          product.totalPrice -= productDiscount;
          product.coupon = productDiscount;
        }
        couponCode = isCoupon;
      } else {
        return res.json({ fail: true, message: "Coupon limit exceeds" });
      }
    }

    let totalAmount = products.reduce(
      (sum, product) => sum + product.totalPrice,
      0
    );
    let finalAmount = totalAmount + deliveryCharge;

    // Create Razorpay order if needed
    let razorpayOrder = null;
    if (payment_method === "razorpay") {
      const options = {
        amount: finalAmount * 100, // Amount in paisa
        currency: "INR",
        receipt: `order_rcptid_${Date.now()}`,
      };
      razorpayOrder = await razorpay.orders.create(options);
    }

    // Create order in database
    const order = new Order({
      user: userId,
      deliveryDetails: selectedAddress,
      products: products,
      totalAmount: finalAmount,
      date: new Date(),
      expected_delivery: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: payment_method === "COD" ? "placed" : "pending", // Changed from "pending"
      paymentMethod: payment_method,
      razorpayOrderId: razorpayOrder ? razorpayOrder.id : null,
      paymentStatus: payment_method === "COD" ? "completed" : "pending", // Added paymentStatus
      couponCode, // Save the coupon code used
    });

    const orderDetails = await order.save();
    const orderId = orderDetails._id;

    switch (payment_method) {
      case "COD":
        await handleCOD(orderDetails, userId, products);
        res.json({ success: true });
        break;
      case "wallet":
        const walletResult = await handleWalletPayment(
          userId,
          finalAmount,
          orderId
        );
        if (walletResult.success) {
          // Reduce product quantities after successful wallet payment
          for (const product of products) {
            const productId = product.productId;
            const variantIndex = product.product;
            const productQuantity = product.quantity;
            await Product.updateOne(
              { _id: productId },
              { $inc: { [`variant.${variantIndex}.stock`]: -productQuantity } }
            );
          }

          // Clear user's cart after successful order placement
          await Cart.deleteOne({ user: userId });

          // Update order status to "placed"
          order.status = "placed";
          await order.save();

          res.json({ success: true });
        } else {
          res.json({ success: false, message: "Insufficient wallet balance" });
        }
        break;
      case "razorpay":
        res.json({
          success: true,
          orderId: orderId,
          razorpayOrderId: razorpayOrder.id,
          amount: finalAmount,
        });
        break;
      default:
        res.status(400).json({ error: "Invalid payment method" });
        break;
    }
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



// Handle payment failure
module.exports.handlePaymentFailure = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "Order ID not provided" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(400).json({ error: "Order not found" });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ error: "Order is not in pending state" });
    }

    // Update order status to "failed"
    order.status = 'failed';
    await order.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Error handling payment failure:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// Handle COD (Cash on Delivery) payment
const handleCOD = async (orderDetails, userId, products) => {
  await Cart.deleteOne({ user: userId });
  for (let product of products) {
    const productId = product.productId;
    const variantIndex = product.product;
    const productQuantity = product.quantity;
    await Product.updateOne(
      { _id: productId },
      { $inc: { [`variant.${variantIndex}.stock`]: -productQuantity } }
    );
  }
};

async function handleWalletPayment(userId, finalAmount, orderId) {
  const result = await updateWallet(
    userId,
    finalAmount,
    "debit",
    `Order Payment - ${orderId}`
  );
  return result;
}

module.exports.verifyPayment = async (req, res) => {
  try {
    const { payment_id, order_id, signature, status, reason } = req.body;
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(order_id + "|" + payment_id);
    const generatedSignature = hmac.digest("hex");

    if (status === "failed") {
      // Update order status to "failed"
      console.log("failed message content: ",req.body)
      const order = await Order.findOne({ razorpayOrderId: order_id });
      console.log("this is from order order failed to check the coupon applied : ",order);
      if (order) {
        const coupon = await Coupon.findOne({ couponCode: order.couponCode });
        console.log("hello from coupon opened :",coupon)
        if (coupon) {
          coupon.userUsed = coupon.userUsed.filter(userId => userId.toString() !== order.user.toString());
          await coupon.save();
        }
      }
      await Order.updateOne({ razorpayOrderId: order_id }, { status: "failed", failureReason: reason ,paymentStatus:"failed"});
      await handleCOD(order, order.user, order.products);
      // Send response
      return res.json({ success: false, message: "Payment failed. Please try again." });
    }

    if (generatedSignature === signature) {
      const order = await Order.findOne({ razorpayOrderId: order_id });
      if (!order) {
        return res
          .status(400)
          .json({ success: false, message: "Order not found" });
      }

      order.status = "placed";
      order.paymentStatus = "completed";
      await order.save();

      await handleCOD(order, order.user, order.products);

      res.json({ success: true,orderId:order._id });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports.loadOrderSucces = (req, res) => {
  try {
    const orderStatus = req.query.status; // 'success' or 'failure'
  const orderNumber = '123456';
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 7); // Estimated delivery in 7 days

  res.render('order-status', {
    orderStatus,
    orderNumber,
    deliveryDate: deliveryDate.toDateString()
  });
  } catch (error) {
    console.log(error);
  }
};

// Function to handle order cancellation request
module.exports.orderCancellation = async (req, res) => {
  try {
    const { orderId, productId, index, cancelReason } = req.body;
    const userId = req.session.user?._id;

    if (!userId) {
      return res.status(400).json({ error: "User not logged in" });
    }

    // Update order status and request cancellation
    await Order.findOneAndUpdate(
      { _id: orderId, "products.productId": productId },
      {
        $set: {
          [`products.${index}.cancelRequest`]: "requested",
          [`products.${index}.cancelReason`]: cancelReason,
          status: "cancelled", // Update order status
        },
      }
    );

    // Refund amount to wallet if paid through wallet or Razorpay
    const order = await Order.findById(orderId);
    if (
      order.paymentMethod === "wallet" ||
      order.paymentMethod === "razorpay"
    ) {
      await updateWallet(
        userId,
        order.products[index].totalPrice,
        "credit",
        `Order Cancelled - ${orderId}`
      );
    }

    res.json({
      success: true,
      message: "Cancellation request sent successfully",
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Function to handle product return request
module.exports.productReturn = async (req, res) => {
  try {
    const { orderId, productId, index, returnReason } = req.body;
    const userId = req.session.user?._id;

    if (!userId) {
      return res.status(400).json({ error: "User not logged in" });
    }

    // Update order status and request return
    await Order.findOneAndUpdate(
      { _id: orderId, "products.productId": productId },
      {
        $set: {
          [`products.${index}.returnRequest`]: "requested",
          [`products.${index}.returnReason`]: returnReason,
          status: "returned", // Update order status
        },
      }
    );

    // Refund amount to wallet if paid through wallet or Razorpay
    const order = await Order.findById(orderId);
    if (
      order.paymentMethod === "wallet" ||
      order.paymentMethod === "razorpay"||
      order.paymentMethod ==="COD"
    ) {
      await updateWallet(
        userId,
        order.products[index].totalPrice,
        "credit",
        `Order Returned - ${orderId}`
      );
    }

    res.json({ success: true, message: "Return request sent successfully" });
  } catch (error) {
    console.error("Error returning product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports.getOrderDetails = async (req, res) => {
  try {
    const orderId = req.query.orderId;
    if (!orderId) {
      return res.status(400).send("Order ID is required");
    }

    const order = await Order.findById(orderId)
      .populate("user")
      .populate("products.productId");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    res.render("singleOrderDetails", { order });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

module.exports.loadInvoice = async (req, res) => {
  try {
    const { orderId, index } = req.query;
    const order = await Order.findOne({ _id: orderId })
      .populate("user")
      .populate("products.productId");

    if (!order || !order.products || order.products.length === 0) {
      return res.status(404).send('Order not found or no products in order');
    }

    res.render("invoice", {
      order,
      deliveryAddress: order.deliveryDetails,
      index: index || 0
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('An error occurred while loading the invoice');
  }
};


module.exports.loadSingleProduct = async (req, res) => {
  try {
    console.log(req.query);
    const userId = req.session.user?._id;
    const { productId, index, size, orderId } = req.query;
    const detials = await Order.findOne({ _id: orderId, user: userId })
      .populate("user")
      .populate("products.productId");
    const product = detials.products.find((pro, i) => i === parseInt(index));
    const review = await Review.findOne({ user: userId, productId: productId });
    res.render("singleProduct", {
      product: product,
      address: detials.deliveryDetails,
      review: review,
      orderId: orderId,
      index: index,
      order: detials,
    });
  } catch (error) {
    console.log(error);
  }
};


module.exports.retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(400).json({ success: false, message: "Order not found" });
    }

    // Create a new Razorpay order
    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: order.totalAmount * 100, // Amount in paisa
      currency: "INR",
      receipt: `order_rcptid_${Date.now()}`,
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    // Update the order with the new Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({ success: true, razorpayOrderId: razorpayOrder.id });
  } catch (error) {
    console.error("Error retrying payment:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
