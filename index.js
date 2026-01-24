import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import session from 'express-session';
import mongoose from 'mongoose';
import methodOverride from 'method-override';
import flash from 'express-flash';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import moment from 'moment';
import userRoute from './router/user.route.js';
import adminRoute from './router/admin.route.js';
import Wishlist from './models/wishlist.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Session middleware setup
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set secure to true if using HTTPS
  }),
);

app.use((req, res, next) => {
  res.locals.moment = moment;
  next();
});

// Middleware to fetch wishlist data
app.use(async (req, res, next) => {
  if (req.session && req.session.user) {
    try {
      const wishlist = await Wishlist.findOne({
        user: req.session.user._id,
      }).populate('products.productId');
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
app.use(methodOverride('_method'));

// Flash notifications
app.use(flash());

// Set view engine
app.set('view engine', 'ejs');
app.set('views', './views/user');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/assets')));

// User route and home route
app.use('/', userRoute);

// Admin route
app.use('/admin', adminRoute);

// Handle other routes (error handling with redirect to 404 page)
app.use('*', (req, res) => {
  res.render('404');
});

// DB connection
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.log('DB connected');
  })
  .catch((err) => {
    console.log(err);
  });

// Server listening on port number
app.listen(process.env.PORT, () => {
  console.log(`http://localhost:${process.env.PORT}`);
});
