import express, { Router } from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import userController from '../controller/user.controller.js';
import productController from '../controller/product.controller.js';

import shopController from '../controller/shop.controller.js';
import User from '../models/user.model.js';
import cartController from '../controller/cart.controller.js';
import orderController from '../controller/order.controller.js';
import review_Controller from '../controller/review.controller.js';
import couponController from '../controller/coupon.controller.js';
import wishlistController from '../controller/wishlist.controller.js';
import reportController from '../controller/report.controller.js';
import { userAuth, isLogined } from '../middleware/user.auth.middleware.js';
import passport from 'passport';
import nocache from 'nocache';
import fetchCartMiddleware from '../middleware/cart.middleware.js';
import checkBlockedStatus from '../middleware/check.block.status.middleware.js';
import path from 'node:path';
import '../config/passport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



const userRoute = Router();


userRoute.use(nocache());

userRoute.use((req, res, next) => {
  res.header('Cache-Control', 'no-store, private, must-revalidate');
  next();
});

userRoute.use(express.static(path.join(__dirname, 'image/product')));

userRoute.use(
  session({
    secret: 'sessionscret',
    resave: false,
    saveUninitialized: true,
  }),
);

userRoute.use(fetchCartMiddleware);
userRoute.use(checkBlockedStatus);

//passport verify
userRoute.use(passport.initialize());
userRoute.use(passport.session());

userRoute.use(express.json());
userRoute.use(express.urlencoded({ extended: true }));

userRoute.use(async (req, res, next) => {
  const id = req.session.user?._id;
  const user = await User.findOne({ _id: id });

  if (user) {
    if (user.isBlocked) {
      fetch('/logout', {
        method: 'POST',
      }).catch((err) => {
        console.log(err);
      });
    }
  }
  next();
});

userRoute.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.logedIn = req.session.user ? true : false;
  next();
});

// load home
userRoute.get('/', userController.loadHome);

// load login
userRoute.get('/login', isLogined, userController.loadLogin);

//post for login details to check
userRoute.post('/login', userController.userLogin);

// load register
userRoute.get('/signUp', isLogined, userController.loadRegister);

// load otp
userRoute.get('/otp', isLogined, userController.loadotp);

// otp post || verify

userRoute.post('/otp', userController.verifyOTP);

// register form sumbit
userRoute.post('/signUp', userController.insertUser);

// login with otp
userRoute.post('/otpLogin', userController.otpLogin);
// load login with otp page
userRoute.get('/otpLogin', isLogined, userController.OTPlogin);

// send otp for login
userRoute.post('/send-otp', userController.sendOtpForLogin);

// Logout the user
userRoute.post('/logout', userController.userLogout);

//the resend the otp again for create another request to generate the new otp
userRoute.post('/resend', userController.resend);

//Google Auth
userRoute.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

// Google Auth Callback
userRoute.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    successRedirect: '/success',
    failureRedirect: '/failure',
  }),
);

// Success
userRoute.get('/success', userController.successGoogleLogin);

// failure
userRoute.get('/failure', userController.failureGoogleLogin);

userRoute.get('/productDetails', productController.productdetiles);

userRoute.get('/shop', shopController.loadShop);

userRoute.post('/checkSession', userController.checkSession);

// ==================================================================== //
userRoute.get('/about', userController.loadAbout);

userRoute.get('/contact', userController.loadContact);

//forget
userRoute.get('/forget-password', userController.loadForget);

userRoute.post('/forget', userController.forgetVerify);

userRoute.get(
  '/change-password/:userId/:token',
  isLogined,
  userController.verifyUser,
);
userRoute.post('/change-password', userController.resetPassword);

//account details section
userRoute.get('/account', userAuth, userController.loadMyAccount);

//user cart render
userRoute.get('/cart', userAuth, cartController.loadCart);

//add procuct into cart
userRoute.post('/add-cart', cartController.addToCart);

//remove product in cart
userRoute.post('/removeFormCart', cartController.removeFromCart);

//user cart product quantity change
userRoute.post('/counter', cartController.changeQuantity);

//user cart check-out
userRoute.get('/check-out', userAuth, cartController.proceedToCheckout);

userRoute.get('/my-order', userAuth, orderController.loadMyOrder);

userRoute.post('/retry-payment', orderController.retryPayment);

userRoute.get('/single-product', userAuth, orderController.loadSingleProduct);

userRoute.post('/add-Address', orderController.addAddress);

userRoute.post('/place-order', orderController.placeOrder);

userRoute.post('/payment-failure', orderController.handlePaymentFailure);

userRoute.get('/order-status', orderController.loadOrderSucces);

userRoute.post('/search', shopController.filter);
userRoute.post('/order-cancel', orderController.orderCancellation);

userRoute.get('/single-orderDetails', orderController.getOrderDetails);

userRoute.get('/wishlist', userAuth, wishlistController.loadWhislist);
userRoute.post('/addWishlist', wishlistController.addTOWhishlist);
userRoute.post('/remove-wishlist', wishlistController.removeFromWishlist);

userRoute.get('/manage-address', userController.loadManageAddress);

// ==================================================================== //

userRoute.post('/addReview', review_Controller.addReview);

userRoute.post('/verify-payment', orderController.verifyPayment);

userRoute.post('/product-return', orderController.productReturn);

userRoute.post('/check-coupon', couponController.checkCoupon);

userRoute.get('/my-coupon', couponController.loadMyCoupon);

userRoute.get('/invoice', orderController.loadInvoice);

userRoute.put('/edit-address', userController.editAddress);

userRoute.delete('/delete-address/:index', userController.deleteAddress);

userRoute.put('/change-password', userController.changePassword);

userRoute.post('/change-details', userController.personalDetails);

userRoute.get('/transactions', userController.transactionHistroy);

userRoute.get('/downloadInvoice', reportController.downloadInvoice);

export default userRoute;