const Cart = require("../models/cartModel");

const fetchCartMiddleware = async (req, res, next) => {
  if (req.session.user) {
    try {
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ user: userId });
      res.locals.cart = cart;
    } catch (error) {
      console.error("Error fetching cart data:", error);
      res.locals.cart = null;
    }
  } else {
    res.locals.cart = null;
  }
  next();
};

module.exports = fetchCartMiddleware;
