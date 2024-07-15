const Cart = require("../models/cartModel");
const Coupon = require("../models/couponModel");
const Wallet =require("../models/walletModel")

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

    res.render("couponManagement", {
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
  const { name, adate, edate, limit, damount } = req.body;

  const firstname = name.split("").slice(0, 4).join("");
  const randomString = Math.random().toString(36).substring(2, 7);
  const radomNumber = `${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    console.log(req.body);

    const newCoupon = new Coupon({
      name: name,
      couponCode: `${firstname}${randomString}${radomNumber}`,
      activationDate: adate,
      expiresDate: edate,
      discountAmount: damount,
      limit: limit,
    });
    await newCoupon.save();
    res.redirect("/admin/load-coupon");
  } catch (error) {
    console.log(error);
  }
};

module.exports.editCoupon = async (req, res) => {
  try {
    const { name, adate, edate, limit, damount, id } = req.body;

    await Coupon.findByIdAndUpdate(
      { _id: id },
      {
        $set: {
          name: name,
          activationDate: adate,
          expiresDate: edate,
          discountAmount: damount,
          limit: limit,
        },
      }
    );
    res.redirect("/admin/load-coupon");
  } catch (error) {
    console.log(error);
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

      let dateStrings = [coupon.activationDate, coupon.expiresDate];
      let isoDateStrings = dateStrings.map(dateString => {
        let dateArray = dateString.split("-");
        return `${dateArray[2]}-${dateArray[1]}-${dateArray[0]}T00:00:00.000Z`;
      });

      let convertedDates = isoDateStrings.map(dateString => new Date(dateString));

      const today = new Date();
      const active = new Date(coupon.activationDate);
      const expire = new Date(coupon.expiresDate);

      if (alreadyUsed) {
        res.json({ used: true, message: "This coupon is already used" });
      } else if (limitOfCoupon) {
        res.json({ limit: true, message: "Coupon limit reached" });
      } else if (!(today >= convertedDates[0] && today <= convertedDates[1])) {
        res.json({ expired: true, message: "Coupon expired" });
      } else {
        const cart = await Cart.findOne({ user: userId });

        let discount = 0;
        const total = cart.products.reduce((acc, crr) => acc + crr.totalPrice, 0);

        if (coupon.percentage) {
          discount = (coupon.percentage / 100) * total;
        } else if (coupon.discountAmount) {
          discount = coupon.discountAmount;
        }

        const cartAmount = total - discount;

        if (total <= 500) {
          res.json({ min: true, message: "Minimum ₹500 needed" });
        } else {
          coupon.userUsed.push(userId);
          await coupon.save();

          res.json({ success: true, subtotal: cartAmount, discount: discount });
        }
      }
    } else {
      res.json({ notAvailable: true, message: "No coupon available" });
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
      res.redirect('/')
    }
    const wallet = await Wallet.findOne({ user: userId });
    const walletBalance = wallet ? wallet.balance : 0;
    const coupon = await Coupon.find();
    res.render("myCoupon", { coupon: coupon , walletBalance });
  } catch (error) {
    console.log(error);
  }
};

module.exports.deleteCoupon = async (req,res)=>{
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
}
