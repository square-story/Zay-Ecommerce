const Cart = require('../models/cartModel');
const Coupon = require('../models/couponModel');
const Wallet = require('../models/walletModel');
const moment = require('moment');

module.exports.loadCoupon = async (req, res) => {
  try {
    // Set default page to 0 if not provided
    let page = req.query.page ? parseInt(req.query.page) : 0;
    const limit = 4;

    // Fetch coupons for the current page
    const coupon = await Coupon.find()
      .skip(page * limit)
      .limit(limit);

    // Fetch the total number of coupons
    const totalCoupons = await Coupon.countDocuments();

    res.render('couponManagement', {
      coupon,
      couponLength: totalCoupons,
      page: page,
      totalPages: Math.ceil(totalCoupons / limit),
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports.createCoupon = async (req, res) => {
  const { name, adate, edate, limit, percentage, maxDiscountAmount, minOrderValue } = req.body;

  // Convert dates to 'YYYY-MM-DD' format to exclude time
  const activationDate = moment(adate, 'YYYY-MM-DD').toDate();
  const expirationDate = moment(edate, 'YYYY-MM-DD').toDate();
  const currentDate = moment().startOf('day').toDate();

  try {
    // Generate a unique coupon code
    let couponCode = await createCouponCode(name);

    // Validate dates
    if (activationDate < currentDate) {
      return res.status(400).send('Activation date must be today or in the future.');
    }
    if (expirationDate <= activationDate) {
      return res.status(400).send('Expiration date must be after the activation date.');
    }

    // Check if a coupon with the same name already exists
    const existingCoupon = await Coupon.findOne({ name: name });
    if (existingCoupon) {
      return res.status(400).send('Coupon with this name already exists.');
    }

    // Validate minimum order value and max discount amount
    if (percentage && parseFloat(minOrderValue) < parseFloat(maxDiscountAmount)) {
      return res
        .status(400)
        .send('Minimum order value cannot be less than the maximum discount amount.');
    }

    // Create and save the new coupon
    const newCoupon = new Coupon({
      name: name,
      couponCode: couponCode,
      activationDate: activationDate,
      expiresDate: expirationDate,
      percentage: percentage,
      maxDiscountAmount: maxDiscountAmount,
      limit: limit,
      minimumOrderValue: minOrderValue,
    });

    await newCoupon.save();
    res.redirect('/admin/load-coupon');
  } catch (error) {
    console.log(error);
    res.status(500).send('An error occurred while creating the coupon.');
  }
};

// Assuming the createCouponCode function is defined elsewhere
async function createCouponCode(name) {
  const firstname = name.substring(0, 4).toUpperCase();
  const randomString = Math.random().toString(36).substring(2, 7).toUpperCase();
  const randomNumber = `${Math.floor(1000 + Math.random() * 9000)}`;

  const couponCode = `${firstname}${randomString}${randomNumber}`;

  // Check for uniqueness (Optional: based on your requirements)
  const existingCoupon = await Coupon.findOne({ couponCode: couponCode });
  if (existingCoupon) {
    return await createCouponCode(name); // Retry if duplicate
  }

  return couponCode;
}

module.exports.editCoupon = async (req, res) => {
  const { name, adate, edate, limit, percentage, maxDiscountAmount, id, minOrderValue } = req.body;

  // Convert dates to 'YYYY-MM-DD' format to exclude time
  const activationDate = moment(adate, 'YYYY-MM-DD').toDate();
  const expirationDate = moment(edate, 'YYYY-MM-DD').toDate();
  const currentDate = moment().startOf('day').toDate();

  try {
    // Validate dates
    if (activationDate < currentDate) {
      return res.status(400).send('Activation date must be in the future.');
    }
    if (expirationDate <= activationDate) {
      return res.status(400).send('Expiration date must be after activation date.');
    }

    const existingCoupon = await Coupon.findById(id);

    if (!existingCoupon) {
      return res.status(404).send('Coupon not found.');
    }

    // Update coupon details
    existingCoupon.name = name;
    existingCoupon.activationDate = activationDate;
    existingCoupon.expiresDate = expirationDate;
    existingCoupon.percentage = percentage;
    existingCoupon.maxDiscountAmount = maxDiscountAmount;
    existingCoupon.limit = limit;
    existingCoupon.minimumOrderValue = minOrderValue;

    await existingCoupon.save();
    res.redirect('/admin/load-coupon');
  } catch (error) {
    console.log(error);
    res.status(500).send('An error occurred while updating the coupon.');
  }
};

module.exports.checkCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user?._id;
    const coupon = await Coupon.findOne({ couponCode: couponCode });

    if (coupon) {
      const alreadyUsed = coupon.userUsed.includes(userId);
      const count = coupon.userUsed.length;
      const limitOfCoupon = coupon.limit === -1 ? false : count >= coupon.limit;

      const today = moment().startOf('day').toDate();
      const active = moment(coupon.activationDate).startOf('day').toDate();
      const expire = moment(coupon.expiresDate).endOf('day').toDate();

      if (alreadyUsed) {
        res.json({ used: true, message: 'This coupon is already used' });
      } else if (limitOfCoupon) {
        res.json({ limit: true, message: 'Coupon limit reached' });
      } else if (!(today >= active && today <= expire)) {
        res.json({ expired: true, message: 'Coupon expired' });
      } else {
        const cart = await Cart.findOne({ user: userId });

        let discount = 0;
        const total = cart.products.reduce((acc, crr) => acc + crr.totalPrice, 0);

        // Include delivery charge in total calculation
        const deliveryCharge = total < 500 ? 80 : 0;
        const totalWithDelivery = total + deliveryCharge;

        if (coupon.percentage) {
          discount = (coupon.percentage / 100) * totalWithDelivery;
        } else if (coupon.discountAmount) {
          discount = coupon.discountAmount;
        }

        discount = Math.min(discount, coupon.maxDiscountAmount || discount); // Ensure discount doesn't exceed max discount

        const cartAmount = totalWithDelivery - discount;

        if (totalWithDelivery < coupon.minimumOrderValue) {
          res.json({
            min: true,
            message: `Minimum order value for this coupon is ₹${coupon.minimumOrderValue}`,
          });
        } else {
          res.json({ success: true, subtotal: cartAmount, discount: discount });
        }
      }
    } else {
      res.json({ notAvailable: true, message: 'No coupon available' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports.loadMyCoupon = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      res.redirect('/');
    }
    const wallet = await Wallet.findOne({ user: userId });
    const walletBalance = wallet ? wallet.balance : 0;
    const coupon = await Coupon.find();
    res.render('myCoupon', { coupon: coupon, walletBalance });
  } catch (error) {
    console.log(error);
  }
};

module.exports.deleteCoupon = async (req, res) => {
  const { id } = req.body;

  try {
    // Assuming you use Mongoose to interact with MongoDB
    const result = await Coupon.findByIdAndDelete(id);
    if (result) {
      // Recalculate the number of coupons after deletion
      const totalCoupons = await Coupon.countDocuments();
      const couponsPerPage = 10; // Adjust based on your requirement
      const totalPages = Math.ceil(totalCoupons / couponsPerPage);

      res.json({ success: true, totalPages: totalPages });
    } else {
      res.json({ success: false, message: 'Coupon not found' });
    }
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports.checkCouponName = async (req, res) => {
  const { name } = req.body;
  try {
    const existingCoupon = await Coupon.findOne({ name });
    if (existingCoupon) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
