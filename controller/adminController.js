const User = require('../models/userModel');
const Catagery = require('../models/cetagory');
const bcrypt = require('bcrypt');
const product = require('../models/product');
const Order = require('../models/order');
const Wallet = require('../models/walletModel');
const adminHelpers = require('../helpers/adminHelper');
const { updateWallet } = require('./walletController');
const Coupon = require('../models/couponModel');
require('dotenv').config();

// load admin home page
module.exports.loadAdmin = async (req, res) => {
  try {
    const currentDate = new Date();
    const startDate = new Date(currentDate - 30 * 24 * 60 * 60 * 1000);

    // Fetch all users
    const users = await User.find();
    const userCount = users.length;

    // Fetch orders placed in the last 30 days
    const orders = await Order.find({
      date: { $gte: startDate, $lt: currentDate },
    });

    // Fetch all orders
    const allOrders = await Order.find();

    // Calculate various metrics
    const orderCount = orders.length;
    const monthlyEarning = orders.reduce(
      (acc, order) => (order.status === 'placed' ? acc + order.totalAmount : acc),
      0,
    );
    const revenue = allOrders.reduce((acc, order) => acc + order.totalAmount, 0);
    const productCount = orders.reduce((acc, order) => acc + order.products.length, 0);

    // Aggregate monthly ordered count
    const monthlyOrderedCount = await Order.aggregate([
      {
        $match: {
          status: 'placed',
          date: { $gte: startDate, $lt: currentDate },
        },
      },
      {
        $group: {
          _id: { $month: '$date' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]);

    // Prepare monthly data array
    const monthlyData = Array.from({ length: 12 }).fill(0);
    monthlyOrderedCount.forEach((item) => {
      const monthIndex = item._id - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyData[monthIndex] = item.totalAmount;
      }
    });

    // Fetch best selling name, category, and brand
    const bestSellingName = await adminHelpers.bestSelling('_id');
    const bestSellingCategory = await adminHelpers.bestSelling('cetagory');
    const bestSellingBrand = await adminHelpers.bestSelling('brand');
    const topTenCategories = await adminHelpers.mapCategory(bestSellingCategory);

    // Render admin dashboard with data
    res.render('adminDashboard', {
      monthlyData,
      userCount,
      monthlyEarning,
      revenue,
      orderCount,
      productCount,
      name: bestSellingName,
      brand: bestSellingBrand,
      topTenCategory: topTenCategories,
    });
  } catch (error) {
    console.log(error);
    // Handle errors appropriately, maybe render an error page
    res.status(500).send('Internal Server Error');
  }
};

//filtering dashboard with functional graph (doesn't working now)
module.exports.filterDashboard = async (req, res) => {
  try {
    const { data } = req.body;
    const desiredMonth = data; // Example for January 2024
    const startDate = new Date(desiredMonth + '-01T00:00:00Z'); // Start of month
    const endDate = new Date(desiredMonth + '-31T23:59:59Z'); // End of month (adjusted for days in February)
    console.log(startDate);
    const monthData = await Order.aggregate([
      {
        $match: {
          status: 'placed',
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%d',
              date: '$date',
            },
          },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]);
    console.log(monthData);

    // Initialize an array with 12 elements, each set to zero
    const newData = Array.from({ length: 30 }).fill(0);

    // Populate the array based on the provided data
    monthData.forEach((item) => {
      console.log(item);
      const monthIndex = parseInt(item._id, 10) - 1; // Convert _id to zero-based index
      if (monthIndex >= 0 && monthIndex < 30) {
        newData[monthIndex] = item.totalAmount;
      }
    });

    console.log(newData);
    res.json({ newData, data });
  } catch (error) {
    console.log(error);
  }
};

// admin login

module.exports.loadLogin = (req, res) => {
  try {
    res.render('admin-login');
  } catch (error) {
    console.log(error);
  }
};

//admin checking the details where the get from admin login
module.exports.login = async (req, res) => {
  try {
    const email = process.env.EMAIL;
    const password = process.env.PASSWORD;
    console.log(email, password);

    if (req.body.email == email) {
      if (req.body.password == password) {
        req.session.admin = email;
        res.redirect('/admin/');
      } else {
        req.flash('password', 'incorrect password');
        res.redirect('/admin/login');
        console.log('Incorrect password');
      }
    } else {
      req.flash('email', 'Enter valid email address');
      res.redirect('/admin/login');
      console.log('incorrect email');
    }
  } catch (error) {}
};

//user page loding with data
module.exports.loadUser = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const searchQuery = req.query.search || '';

    // Create a filter based on the search query
    const filter = searchQuery ? { name: { $regex: searchQuery, $options: 'i' } } : {};

    // Get the total count of users matching the filter
    const userCount = await User.countDocuments(filter);

    // Fetch the users with pagination and search applied
    const users = await User.find(filter)
      .skip(page * 4)
      .limit(4);

    // Render the user management page with the data
    res.render('userManagement', {
      users: users,
      userLength: Math.ceil(userCount / 4), // Total pages
      page: page,
      searchQuery: searchQuery, // Pass the search query to the view
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error loading users');
  }
};

//blocking an user
module.exports.blockUser = (req, res) => {
  const id = req.body.id;
  console.log(id);

  return User.findOne({ _id: id })
    .then((user) => {
      if (user.isBlocked) {
        console.log(user);
        console.log('unblock');
        return User.updateOne(
          { _id: id },
          {
            $set: {
              isBlocked: false,
            },
          },
        );
      } else {
        console.log('block');
        return User.updateOne(
          { _id: id },
          {
            $set: {
              isBlocked: true,
            },
          },
        );
      }
    })
    .then(() => {
      res.json({ block: true });
    })
    .catch((err) => {
      console.log(err);
    });
};

// load product management page
module.exports.loadPoduct = async (req, res) => {
  const search = req.query.search;
  const page = parseInt(req.query.page) || 0; // Default to 0 if not provided
  const limit = 4; // Number of products per page

  // Build search query
  let query = {};
  if (search) {
    query = {
      $or: [
        { name: new RegExp(search, 'i') }, // Case-insensitive search in name
        { 'cetagory.name': new RegExp(search, 'i') }, // Case-insensitive search in category name
      ],
    };
  }

  try {
    // Get the total number of products matching the search query
    const totalProducts = await product.countDocuments(query);

    // Get the products with pagination and search query
    const products = await product
      .find(query)
      .populate('cetagory')
      .skip(page * limit)
      .limit(limit)
      .exec();

    res.render('adminProducts', {
      products,
      productLength: totalProducts,
      page,
      search,
      limit,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Server Error');
  }
};

// load add product page

module.exports.loadAddProduct = (req, res) => {
  try {
    return Catagery.find()
      .then((data) => {
        console.log(data[1].name);
        res.render('addProduct', {
          cetagory: data,
          messages: {
            blocked: req.flash('blocked'),
            pass: req.flash('pass'),
            found: req.flash('found'),
          },
          data: req.flash('data')[0] || {},
        });
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (error) {
    console.log(error);
  }
};

//logout page collection
module.exports.logout = (req, res) => {
  try {
    req.session.admin = null;
    res.redirect('/admin/login');
  } catch (error) {
    console.log(error);
  }
};

module.exports.loadOrder = async (req, res) => {
  try {
    const page = req.query.page;
    const orderLength = await Order.find();
    const order = await Order.find()
      .populate('user')
      .populate('products.productId')
      .sort({ date: -1 })
      .skip(page * 8)
      .limit(8);

    console.log(order);
    res.render('order-details', {
      order: order,
      page: parseInt(page),
      orderLength: orderLength.length,
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports.loadsingleOrder = async (req, res) => {
  try {
    console.log(req.query);
    const { orderId, returns } = req.query;
    const orderDetails = await Order.findById({ _id: orderId })
      .populate('user')
      .populate('products.productId');
    console.log(orderDetails);
    if (returns) {
      return res.render('returnSingleProduct', { order: orderDetails });
    }
    res.render('singleOrderDetials', { order: orderDetails });
  } catch (error) {
    console.log(error);
  }
};

module.exports.changeOrderStatus = async (req, res) => {
  try {
    const { orderId, productId, index, status, userId } = req.body;

    console.log(req.body);

    const order = await Order.findOneAndUpdate(
      { _id: orderId, user: userId, 'products.productId': productId },
      {
        $set: {
          [`products.${index}.status`]: status,
        },
      },
      {
        new: true,
      },
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (status === 'canceled') {
      const amount =
        order.products[index].coupon > 0
          ? order.products[index].coupon
          : order.products[index].price;

      // Increment product stock
      const quantity = order.products[index].quantity;
      await product.findOneAndUpdate(
        { _id: productId },
        {
          $inc: {
            [`variant.${index}.stock`]: quantity,
          },
        },
      );
    }

    res.json({ success: true, status: status });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

module.exports.loadCancel = async (req, res) => {
  try {
    const order = await Order.find({ 'products.cancelRequest': 'requested' })
      .populate('user')
      .populate('products.productId');
    res.render('cancelRequest', { order: order });
  } catch (error) {
    console.log(error);
  }
};

module.exports.controlCancelation = async (req, res) => {
  console.log('cancelation');
  try {
    const { orderId, productId, index, decision } = req.body;

    // Fetch the order
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const userId = order.user;
    const orderProduct = order.products[index];

    if (decision === 'accepted') {
      // Update the product status to canceled
      await Order.findByIdAndUpdate(
        { _id: orderId, 'products.productId': productId },
        {
          $set: {
            [`products.${index}.cancelRequest`]: decision,
            [`products.${index}.status`]: 'canceled',
          },
        },
        {
          new: true,
        },
      );

      // Adjust the stock for the canceled product
      const quantity = orderProduct.quantity;
      await product.findOneAndUpdate(
        { _id: productId },
        {
          $inc: {
            [`variant.${index}.stock`]: quantity,
          },
        },
      );

      // Check the remaining total amount after this product's return
      const remainingTotal = order.products
        .filter((prod, i) => i !== index && prod.status !== 'canceled')
        .reduce((sum, prod) => sum + prod.totalPrice, 0);

      let refundAmount = orderProduct.totalPrice;

      // If there's a coupon applied and the remaining total doesn't meet the minimum required amount
      if (order.couponCode && remainingTotal < order.couponMinimumAmount) {
        // Adjust the refund by removing the coupon discount
        refundAmount -= order.couponAmount;
      }

      // Round the refund amount to 2 decimal places
      refundAmount = parseFloat(refundAmount.toFixed(2));

      // Refund amount to wallet or initiate Razorpay refund if applicable
      if (order.paymentMethod === 'wallet' || order.paymentMethod === 'razorpay') {
        await updateWallet(userId, refundAmount, 'credit', `Order Cancelled - ${orderId}`);
      }

      // If the coupon was applied and removed, update the coupon's usage
      if (order.couponCode && remainingTotal < order.couponMinimumAmount) {
        await Coupon.findOneAndUpdate(
          { couponCode: order.couponCode },
          { $pull: { userUsed: userId } },
        );
      }

      // Check if all products in the order are canceled/returned
      const allProductsCanceled = order.products.every((prod) => prod.status === 'canceled');

      // If all products are canceled, update the order status
      if (allProductsCanceled) {
        await Order.findByIdAndUpdate(orderId, {
          $set: { status: 'returned' },
        });
      }

      res.json({ success: true });
    } else if (decision === 'denied') {
      // If the decision is 'denied', just update the cancel request status
      await Order.findByIdAndUpdate(
        { _id: orderId, 'products.productId': productId },
        {
          $set: {
            [`products.${index}.cancelRequest`]: decision,
          },
        },
      );
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'Invalid decision' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports.loadSingleCancelation = async (req, res) => {
  try {
    console.log(req.query);
    const { orderId, returns } = req.query;
    const orderDetails = await Order.findById({ _id: orderId })
      .populate('user')
      .populate('products.productId');
    console.log(orderDetails);
    if (returns) {
      return res.render('cancelationDetails', { order: orderDetails });
    }
    res.render('singleOrderDetials', { order: orderDetails });
  } catch (error) {
    console.log(error);
  }
};

module.exports.loadReturns = async (req, res) => {
  try {
    const order = await Order.find({ 'products.returnRequest': 'requested' })
      .populate('user')
      .populate('products.productId');
    res.render('returnRequest', { order: order });
  } catch (error) {
    console.log(error);
  }
};

module.exports.returns = async (req, res) => {
  console.log('returns');
  try {
    const { orderId, productId, index, decision } = req.body;

    if (decision === 'accepted') {
      // Fetch the order
      const order = await Order.findById(orderId);

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      const userId = order.user;
      const orderProduct = order.products[index];
      const appliedCoupon = order.couponCode
        ? await Coupon.findOne({ couponCode: order.couponCode })
        : null;

      // Update the product status to returned
      await Order.findByIdAndUpdate(
        { _id: orderId, 'products.productId': productId },
        {
          $set: {
            [`products.${index}.returnRequest`]: decision,
            [`products.${index}.status`]: 'returned',
          },
        },
        {
          new: true,
        },
      );

      // Adjust the stock for the returned product
      const quantity = orderProduct.quantity;
      await product.findOneAndUpdate(
        { _id: productId },
        {
          $inc: {
            [`variant.${index}.stock`]: quantity,
          },
        },
      );

      // Calculate the remaining total amount after this product's return
      const remainingTotal = order.products
        .filter((prod, i) => i !== index && prod.status !== 'returned')
        .reduce((sum, prod) => sum + (prod.totalPrice || 0), 0);

      let refundAmount = orderProduct.totalPrice;

      // If there's a coupon applied and the remaining total doesn't meet the minimum required amount
      if (appliedCoupon && remainingTotal < appliedCoupon.minimumOrderValue) {
        // Adjust the refund by removing the coupon discount
        refundAmount -= appliedCoupon.couponAmount;
      }

      // Round the refund amount to 2 decimal places
      refundAmount = parseFloat(refundAmount.toFixed(2));

      // Refund amount to wallet or Razorpay
      if (order.paymentMethod === 'wallet' || order.paymentMethod === 'razorpay') {
        await updateWallet(userId, refundAmount, 'credit', `Order Returned - ${orderId}`);
      }

      // If the coupon was applied and the remaining total is below the minimum amount, update the coupon's usage
      if (order.couponCode && remainingTotal < appliedCoupon.minimumOrderValue) {
        await Coupon.findOneAndUpdate(
          { couponCode: order.couponCode },
          { $pull: { userUsed: userId } },
        );
      }

      // Check if all products in the order are returned
      const allProductsReturned = order.products.every((prod) => prod.status === 'returned');

      // If all products are returned, update the order status
      if (allProductsReturned) {
        await Order.findByIdAndUpdate(orderId, {
          $set: { status: 'returned' },
        });
      }

      res.json({ success: true });
    } else if (decision === 'denied') {
      // If the decision is 'denied', just update the return request status
      await Order.findByIdAndUpdate(
        { _id: orderId, 'products.productId': productId },
        {
          $set: {
            [`products.${index}.returnRequest`]: decision,
          },
        },
      );
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'Invalid decision' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
