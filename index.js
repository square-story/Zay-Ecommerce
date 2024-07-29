const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const flash = require("express-flash");
const path = require("node:path");

const userRoute = require("./router/userRoute");
const adminRoute = require("./router/adminRoute");
const Wishlist = require("./models/wishlistModel");

const app = express();

// Session middleware setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set secure to true if using HTTPS
}));

// Middleware to fetch wishlist data
app.use(async (req, res, next) => {
  if (req.session && req.session.user) {
    try {
      const wishlist = await Wishlist.findOne({ user: req.session.user._id }).populate('products.productId');
      res.locals.wishlist = wishlist || { products: [] };
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      res.locals.wishlist = { products: [] };
    }
  } else {
    res.locals.wishlist = { products: [] };
  }
  next();
});

// Method override for RESTful API design
app.use(methodOverride("_method"));

// Flash notifications
app.use(flash());

// Set view engine
app.set("view engine", "ejs");
app.set("views", "./views/user");

// Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "public/assets")));

// User route and home route
app.use("/", userRoute);

// Admin route
app.use("/admin", adminRoute);

// Handle other routes (error handling with redirect to 404 page)
app.use("*", (req, res) => {
  res.render("404");
});

// DB connection
mongoose.connect(process.env.MONGODB_URL)
  .then(() => {
    console.log("DB connected");
  })
  .catch((err) => {
    console.log(err);
  });

// Server listening on port number
app.listen(process.env.PORT, () => {
  console.log(`http://localhost:${process.env.PORT}`);
});
