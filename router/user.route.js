import express, { Router } from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import userAuthController from '../controller/user.auth.controller.js';
import userProfileController from '../controller/user.profile.controller.js';
import userAddressController from '../controller/user.address.controller.js';
import homeController from '../controller/home.controller.js';
import productController from '../controller/product.controller.js';

import shopController from '../controller/shop.controller.js';
import User from '../models/user.model.js';
import cartController from '../controller/cart.controller.js';
// import orderController from '../controller/order.controller.js';
import orderManagementController from '../controller/order.management.controller.js';
import orderPlacementController from '../controller/order.placement.controller.js';
import invoiceController from '../controller/invoice.controller.js';
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
userRoute.get('/', homeController.loadHome);

// load login
userRoute.get('/login', isLogined, userAuthController.loadLogin);

//post for login details to check
userRoute.post('/login', userAuthController.userLogin);

// load register
userRoute.get('/signUp', isLogined, userAuthController.loadRegister);

// load otp
userRoute.get('/otp', isLogined, userAuthController.loadotp);

// otp post || verify

userRoute.post('/otp', userAuthController.verifyOTP);

// register form sumbit
userRoute.post('/signUp', userAuthController.insertUser);

// login with otp
userRoute.post('/otpLogin', userAuthController.otpLogin);
// load login with otp page
userRoute.get('/otpLogin', isLogined, userAuthController.OTPlogin);

// send otp for login
userRoute.post('/send-otp', userAuthController.sendOtpForLogin);

// Logout the user
userRoute.post('/logout', userAuthController.userLogout);

//the resend the otp again for create another request to generate the new otp
userRoute.post('/resend', userAuthController.resend);

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
userRoute.get('/success', userAuthController.successGoogleLogin);

// failure
userRoute.get('/failure', userAuthController.failureGoogleLogin);

userRoute.get('/productDetails', productController.productdetiles);

userRoute.get('/shop', shopController.loadShop);

userRoute.post('/checkSession', userAuthController.checkSession);

// ==================================================================== //
userRoute.get('/about', homeController.loadAbout);

userRoute.get('/contact', homeController.loadContact);

//forget
userRoute.get('/forget-password', userAuthController.loadForget);

userRoute.post('/forget', userAuthController.forgetVerify);

userRoute.get(
  '/change-password/:userId/:token',
  isLogined,
  userAuthController.verifyUser,
);
userRoute.post('/change-password', userAuthController.resetPassword);

//account details section
userRoute.get('/account', userAuth, userProfileController.loadMyAccount);

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

userRoute.get('/my-order', userAuth, orderManagementController.loadMyOrder);

userRoute.post('/retry-payment', orderPlacementController.retryPayment);

userRoute.get('/single-product', userAuth, orderManagementController.loadSingleProduct);

userRoute.post('/add-Address', orderManagementController.addAddress);

userRoute.post('/place-order', orderPlacementController.placeOrder);

userRoute.post('/payment-failure', orderPlacementController.handlePaymentFailure);

userRoute.get('/order-status', orderManagementController.loadOrderSucces);

userRoute.post('/search', shopController.filter);
userRoute.post('/order-cancel', orderManagementController.orderCancellation);

userRoute.get('/single-orderDetails', orderManagementController.getOrderDetails);

userRoute.get('/wishlist', userAuth, wishlistController.loadWhislist);
userRoute.post('/addWishlist', wishlistController.addTOWhishlist);
userRoute.post('/remove-wishlist', wishlistController.removeFromWishlist);

userRoute.get('/manage-address', userAddressController.loadManageAddress);

// ==================================================================== //

userRoute.post('/addReview', review_Controller.addReview);

userRoute.post('/verify-payment', orderPlacementController.verifyPayment);

userRoute.post('/product-return', orderManagementController.productReturn);

// userRoute.post('/check-coupon', couponController.checkCoupon);

userRoute.get('/my-coupon', couponController.loadMyCoupon);

userRoute.get('/invoice', invoiceController.loadInvoice);

userRoute.put('/edit-address', userAddressController.editAddress);

userRoute.delete('/delete-address/:index', userAddressController.deleteAddress);

userRoute.put('/change-password', userProfileController.changePassword);

userRoute.post('/change-details', userProfileController.personalDetails);

userRoute.get('/transactions', userProfileController.transactionHistroy);

userRoute.get('/downloadInvoice', invoiceController.downloadInvoice);

export default userRoute;