const Address = require("../models/address");
const Cart = require("../models/cartModel");
const Order = require("../models/order");
const Product = require("../models/product");
const Review = require("../models/reviewModal");
// const Wallet = require("../models/walletModal");
const Coupon = require("../models/couponModel");

const crypto = require("crypto");
require("dotenv").config();

module.exports.loadMyOrder = async (req, res) => {
  try {
    const page = req.query.page;
    const userid = req.session.user?._id;
    console.log(typeof userid, userid);
    const orderLength = await Order.find({ user: userid });
    const order = await Order.find({ user: userid })
      .populate("user")
      .sort({ "products.date": -1 })
      .skip(page * 4)
      .limit(4);
    console.log(order);
    res.render("myOrder", {
      order: order,
      page: parseInt(page),
      orderLength: orderLength.length,
    });
  } catch (error) {
    console.log(error);
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
      return res.status(400).json({ error: 'User not logged in' });
    }

    const { index, payment_method, subtotal: subtotalStr, isCoupon } = req.body;
    console.log("Received place order request with data:", req.body);

    // Ensure subtotal is a number
    const subtotal = parseFloat(subtotalStr);
    if (isNaN(subtotal)) {
      return res.status(400).json({ error: 'Invalid subtotal value' });
    }

    let cart = await Cart.findOne({ user: userId }).populate("products.productId");
    if (!cart) {
      console.log("No cart found for user:", userId);
      return res.status(400).json({ error: 'Cart not found for user' });
    }
    const products = cart.products;
    console.log("Cart details:", cart);

    const addresses = await Address.findOne({ user: userId }, { address: 1 });
    if (!addresses) {
      console.log("No addresses found for user:", userId);
      return res.status(400).json({ error: 'No addresses found for user' });
    }
    console.log("Address details:", addresses);

    const status = payment_method === "COD" ? "placed" : "pending";
    const selectedAddress = addresses.address[index];
    if (!selectedAddress) {
      console.log("No address found at index:", index);
      return res.status(400).json({ error: 'Address not found' });
    }

    const date = new Date();
    const deliveryDate = new Date(date.getTime() + 10 * 24 * 60 * 60 * 1000)
      .toLocaleString("en-US", { year: "numeric", month: "short", day: "2-digit" })
      .replace(/\//g, "-");

    // Check for out-of-stock products
    for (let el of products) {
      if (el.productId.variant[el.product].stock < el.quantity) {
        return res.json({ remove: true, message: "Remove out of stocks" });
      }
    }
    console.log("All products in stock.");

    // Calculate delivery charge
    let deliveryCharge = subtotal < 500 ? 80 : 0;
    console.log("Delivery charge:", deliveryCharge);

    // Apply coupon if any
    let discount = 0;
    if (isCoupon) {
      const coupon = await Coupon.findOne({ couponCode: isCoupon });
      console.log("Coupon details:", coupon);

      if (coupon && coupon.limit >= coupon.userUsed.length) {
        discount = coupon.discountAmount || 0;
        coupon.userUsed.push(userId);
        await coupon.save();

        // Apply discount proportionally to products
        const discountPerProduct = discount / products.length;
        for (let i = 0; i < products.length; i++) {
          const product = products[i];
          const productDiscount = Math.min(product.totalPrice, discountPerProduct);
          product.totalPrice -= productDiscount;
          product.coupon = productDiscount; // Save the discount applied to the product
        }
      } else {
        return res.json({ fail: true, message: "Coupon limit exceeds" });
      }
    }
    console.log("Discount amount:", discount);

    // Calculate final amount
    let totalAmount = products.reduce((sum, product) => sum + product.totalPrice, 0);
    let finalAmount = totalAmount + deliveryCharge;
    console.log("Final amount after coupon and delivery charge:", finalAmount);

    // Create new order
    const order = new Order({
      user: userId,
      deliveryDetails: selectedAddress,
      products: products,
      totalAmount: finalAmount,
      date: date,
      expected_delivery: deliveryDate,
      status: status,
      paymentMethod: payment_method,
    });

    const orderDetails = await order.save();
    const orderId = orderDetails._id;

    console.log("Order created successfully:", orderDetails);

    // Payment methods
    switch (payment_method) {
      case "COD":
        await handleCOD(orderDetails, userId, products);
        res.json({ success: true });
        break;
      case "wallet":
        const walletResult = await handleWalletPayment(userId, subtotal, orderId);
        if (walletResult.success) {
          res.json({ wallet: true });
        } else {
          res.json({ money: true });
        }
        break;
      default:
        const razorpayOrder = await handleRazorpayPayment(orderDetails, subtotal);
        res.json({ order: razorpayOrder });
        break;
    }
  } catch (error) {
    console.error("Error placing order:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



const handleCOD = async (orderDetails, userId, products) => {
  await Cart.deleteOne({ user: userId });
  for (let product of products) {
    const productId = product.productId;
    const variantIndex = product.product;
    const productQuantity = product.quantity;
    await Product.updateOne({ _id: productId }, {
      $inc: { [`variant.${variantIndex}.stock`]: -productQuantity },
    });
  }
};

const handleWalletPayment = async (userId, subtotal, orderId) => {
  const wallet = await Wallet.findOne({ user: userId });
  if (subtotal <= wallet.amount) {
    const data = { amount: subtotal, date: new Date() };
    await Wallet.findOneAndUpdate(
      { user: userId },
      { $inc: { amount: -subtotal }, $push: { walletHistory: data } }
    );
    await Order.findOneAndUpdate({ _id: orderId }, { $set: { status: "placed" } });

    const cart = await Cart.findOne({ user: userId }).populate("products.productId");
    const products = cart.products;
    await handleCOD({ status: "placed" }, userId, products);

    return { success: true };
  } else {
    return { success: false };
  }
};

const handleRazorpayPayment = async (orderDetails, subtotal) => {
  const options = {
    amount: subtotal * 100,
    currency: "INR",
    receipt: "" + orderDetails._id,
  };

  return new Promise((resolve, reject) => {
    instance.orders.create(options, function (err, order) {
      if (err) {
        console.error(err);
        return reject(err);
      }
      resolve(order);
    });
  });
};

module.exports.loadOrderSucces = (req, res) => {
  try {
    res.render("orderSucces");
  } catch (error) {
    console.log(error);
  }
};

module.exports.orderCancelation = async (req, res) => {
  try {
    const { orderId, productId, index, cancelReason } = req.body;

    const userId = req.session.user?._id;
    console.log(req.body, userId);
    if (userId) {
      return Order.findOneAndUpdate(
        { _id: orderId, "products.productId": productId },
        {
          $set: {
            [`products.${index}.cancelRequest`]: "requested",
            [`products.${index}.cancelReason`]: cancelReason,
          },
        }
      ).then(() => {
        res.json({ return: true });
      });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports.productReturn = async (req, res) => {
  try {
    const { orderId, productId, index, returnReason } = req.body;

    const userId = req.session.user?._id;
    console.log(req.body, userId);
    if (userId) {
      return Order.findOneAndUpdate(
        { _id: orderId, "products.productId": productId },
        {
          $set: {
            [`products.${index}.returnRequest`]: "requested",
            [`products.${index}.returnReason`]: returnReason,
          },
        }
      ).then(() => {
        res.json({ return: true });
      });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports.singleOrderDetials = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (userId) {
      const { orderId } = req.query;
      const order = await Order.findById({ _id: orderId })
        .populate("user")
        .populate("products.productId");
      console.log(order);
      res.render("orderDetails", { myOrder: order });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports.loadInvoice = async (req, res) => {
    try {
      const { orderId, index } = req.query;
      const order = await Order.findOne({ _id: orderId })
        .populate("user")
        .populate("products.productId");
      console.log(order[index], order);
      res.render("invoice", {
        order: order.products[index],
        deliveryAddress: order.deliveryDetails,
      });
    } catch (error) {
      console.log(error);
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