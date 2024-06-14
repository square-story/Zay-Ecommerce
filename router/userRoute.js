const express = require("express");
const session = require("express-session");
const userRoute = express();
const userController = require("../controller/userController");
const productController = require("../controller/product");
userRoute.set("view engine", "ejs");
userRoute.set("views", "./views/user");
const shopController = require("../controller/shop");
const User = require("../models/userModel");
const userMiddleware = require("../middleware/userAuth");
const passport = require('passport'); 
const nocache = require("nocache");
require('../passport');

userRoute.use(nocache());

userRoute.use((req, res, next) => {
  res.header("Cache-Control", "no-store, private, must-revalidate");
  next();
});

const path = require("node:path");
userRoute.use(express.static(path.join(__dirname, "image/product")));

userRoute.use(
  session({
    secret: "sessionscret",
    resave: false,
    saveUninitialized: true,
  })
);

//passport verify
userRoute.use(passport.initialize()); 
userRoute.use(passport.session());

userRoute.use(express.json());
userRoute.use(express.urlencoded({ extended: true }));

userRoute.use(async (req, res, next) => {
  const id = req.session.user?._id;
  console.log(id, "middleware");

  const user = await User.findOne({ _id: id });

  if (user) {
    if (user.isBlocked) {
      fetch("http://localhost:3000/logout", {
        method: "POST",
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
userRoute.get("/", userController.loadHome);

// load login
userRoute.get("/login", userMiddleware.isLogined, userController.loadLogin);

//post for login details to check
userRoute.post("/login", userController.userLogin);

// load register
userRoute.get("/signUp", userMiddleware.isLogined, userController.loadRegister);

// load otp
userRoute.get("/otp", userMiddleware.isLogined, userController.loadotp);

// otp post || verify

userRoute.post("/otp", userController.verifyOTP);

// register form sumbit
userRoute.post("/signUp", userController.insertUser);

// login with otp
userRoute.post("/otpLogin", userController.otpLogin);
// load login with otp page

userRoute.get("/otpLogin", userMiddleware.isLogined, userController.OTPlogin);

// Logout the user
userRoute.post("/logout", userController.userLogout);

//the resend the otp again for create another request to generate the new otp
userRoute.post("/resend", userController.resend);

//Google Auth 
userRoute.get('/auth/google',
  passport.authenticate('google', { scope: 
	[ 'email', 'profile' ] 
}))

// Google Auth Callback
userRoute.get( '/auth/google/callback', 
	passport.authenticate( 'google', { 
		successRedirect: '/success', 
		failureRedirect: '/failure'
}));

// Success 
userRoute.get('/success' , userController.successGoogleLogin); 

// failure 
userRoute.get('/failure' , userController.failureGoogleLogin);

userRoute.get("/productDetails", productController.productdetiles);

userRoute.get("/shop", shopController.loadShop);

userRoute.post("/checkSession", userController.checkSession);

// ==================================================================== //
userRoute.get("/about", userController.loadAbout);

userRoute.get("/contact", userController.loadContact);

module.exports = userRoute;
