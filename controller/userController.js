const User = require('../models/userModel');
const Wallet = require('../models/walletModel');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const axios = require('axios');
const verifyOtp = require('../models/otpVerification');
const Product = require('../models/product');
const Address = require('../models/address');
const Review = require('../models/reviewModal');
require('dotenv').config();

class UserController {

  // ================================== Helper Functions ===============================================\\

  sendEmailViaBrevo = async (toEmail, subject, htmlContent) => {
    try {
      const response = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { email: process.env.SMTP_USER },
          to: [{ email: toEmail }],
          subject: subject,
          htmlContent: htmlContent,
        },
        {
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            'accept': 'application/json',
          },
        }
      );
      console.log('Email sent successfully via Brevo API:', response.data);
      return true;
    } catch (error) {
      console.error('Error sending email via Brevo API:', error.response ? error.response.data : error.message);
      return false;
    }
  };

  sentOtp = async (email) => {
    try {
      console.log('Sending OTP via Brevo API...');
      const createdOTP = `${Math.floor(1000 + Math.random() * 9000)}`;
      const htmlContent = `<p>Your otp is ${createdOTP}</p>`;

      await this.sendEmailViaBrevo(email, 'OTP Verification', htmlContent);

      const hashOTP = await bcrypt.hash(createdOTP, 10);
      const otp = new verifyOtp({
        Email: email,
        otp: hashOTP,
      });

      await otp.save();
    } catch (error) {
      console.log(error);
    }
  };

  generateResetToken() {
    return Math.random().toString(20).substring(2, 12); // Example for illustration
  }

  sendVerificationEmail = async (user, token) => {
    const htmlContent = `
      <p>Click on the link below to verify your account:</p>
      <a href="${process.env.PROJECT_URL}/change-password/${user._id}/${token}">Verify Account</a>
    `;

    await this.sendEmailViaBrevo(user.email, 'Account Verification', htmlContent);
  }

  // ================================== User Controllers ===============================================\\

  // load home page
  loadHome = async (req, res) => {
    try {
      const featuredProductCount = 3;
      const product = await Product.find({ isListed: true })
        .sort({ created: -1 })
        .limit(featuredProductCount)
        .populate('cetagory');

      const productObjectIds = product.map((product) => product._id);
      const reviews = await Review.find({
        productId: { $in: productObjectIds },
      }).lean();
      const productRatings = {};
      const reviewCounts = {};

      productObjectIds.forEach((id) => {
        const productReviews = reviews.filter(
          (review) => review.productId && review.productId.toString() === id.toString(),
        );
        if (productReviews.length > 0) {
          const totalRating = productReviews.reduce((acc, review) => acc + review.rating, 0);
          productRatings[id.toString()] = Number((totalRating / productReviews.length).toFixed(1));
          reviewCounts[id.toString()] = productReviews.length;
        } else {
          productRatings[id.toString()] = 0;
          reviewCounts[id.toString()] = 0;
        }
      });

      if (product) {
        res.render('home', { product: product, title: 'Zay fashion', productRatings, reviewCounts });
      }
    } catch (error) {
      console.log(error);
    }
  };

  // load login page
  loadLogin = (req, res) => {
    try {
      const message = req.query.message;
      res.render('login', { message });
    } catch (error) {
      console.log(error);
    }
  };

  userLogin = async (req, res) => {
    try {
      const email = req.body.email.trim();
      const password = req.body.password.trim();

      // Validate email and password presence
      if (!email || !password) {
        req.flash('blocked', 'Email and password are required');
        return res.redirect('/login');
      }

      const user = await User.findOne({ email });
      if (user) {
        if (user.verified) {
          if (user.isBlocked) {
            req.flash('blocked', 'You are blocked by admin');
            res.redirect('/login');
            console.log('User is blocked');
          } else {
            const pass = await bcrypt.compare(password, user.password);
            console.log(pass);
            if (pass) {
              req.session.user = {
                _id: user._id,
                name: user.name,
                email: user.email,
              };
              res.redirect(`/`);
            } else {
              req.flash('blocked', 'Enter correct password');
              res.redirect('/login');
              console.log('Incorrect password');
            }
          }
        } else {
          res.redirect(`/otp?email=${email}&is=${true}&first=${true}`);
          console.log('User not verified');
        }
      } else {
        req.flash('found', 'Email not found');
        res.redirect('/login');
        console.log('User not found');
      }
    } catch (error) {
      console.log(error);
      req.flash('error', 'An error occurred during login');
      res.redirect('/login');
    }
  };

  // load sign up page
  loadRegister = (req, res) => {
    try {
      res.render('register');
    } catch (error) {
      console.log(error);
    }
  };

  // register user
  insertUser = async (req, res) => {
    try {
      const { uname, email, phone, password, conform } = req.body;

      // Check if username or email already exists
      const existingUserByName = await User.findOne({ name: uname });
      const existingUserByEmail = await User.findOne({ email: email });

      if (existingUserByName) {
        req.flash('uname', 'Username already exists');
        return res.redirect('/signUp');
      }

      if (existingUserByEmail) {
        req.flash('email', 'Email already exists');
        return res.redirect('/signUp');
      }

      // Validate password
      if (!password || password.trim() === '') {
        req.flash('password', 'Password cannot be empty');
        return res.redirect('/signUp');
      }

      const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*]).{6,}$/;
      if (!passwordRegex.test(password.trim())) {
        req.flash('password', 'Password must be 6+ chars with uppercase and special char.');
        return res.redirect('/signUp');
      }

      if (password !== conform) {
        req.flash('password', 'Passwords should be the same');
        return res.redirect('/signUp');
      }

      // Hash password
      const passHash = await bcrypt.hash(password, 10);

      // Create and save user
      const user = new User({
        name: uname,
        email: email,
        mobile: phone,
        password: passHash,
        verified: false,
      });

      const wallet = new Wallet({ user: user._id });
      user.wallet = wallet._id;

      await wallet.save();
      const savedUser = await user.save();

      if (savedUser) {
        await this.sentOtp(user.email);
        res.redirect(`/otp?email=${user.email}`);
      } else {
        console.log('User not saved.');
        res.status(500).send('User registration failed.');
      }
    } catch (error) {
      console.error('Error in user registration:', error);
      res.status(500).send('Server error');
    }
  };

  // load otp page
  loadotp = async (req, res) => {
    try {
      const email = req.query.email;

      // Check if email is provided
      if (!email) {
        return res.render('error', { message: 'Email parameter is missing' });
      }

      const user1 = await User.findOne({ email: email });

      if (!user1) {
        return res.render('error', { message: 'User not found' });
      }

      const verify = user1.verified;
      res.render('otp', { email: email, verify: verify });
    } catch (error) {
      console.log(error);
      res.render('error', { message: 'An unexpected error occurred' });
    }
  };

  sendOtpForLogin = async (req, res) => {
    try {
      const email = req.body.email;
      if (!email) {
        req.flash('blocked', 'Email is required');
        return res.redirect('/otpLogin');
      }

      const user = await User.findOne({ email: email });

      if (!user) {
        req.flash('blocked', 'User not found');
        return res.redirect('/otpLogin');
      }

      if (user.isBlocked) {
        req.flash('blocked', 'Your account is blocked');
        return res.redirect('/otpLogin');
      }

      // Clean up old OTPs and send new one
      await verifyOtp.deleteMany({ Email: email });
      await this.sentOtp(email);

      res.redirect(`/otp?email=${email}`);

    } catch (error) {
      console.log(error);
      req.flash('blocked', 'Something went wrong');
      res.redirect('/otpLogin');
    }
  };

  OTPlogin = (req, res) => {
    try {
      res.render('otpLogin');
    } catch (error) {
      console.log(error);
    }
  };

  verifyOTP = async (req, res) => {
    try {
      const email = req.query.email;
      console.log('otp verify email', email);
      const user = await User.findOne({ email: email });
      const otp = req.body.otp1 + req.body.otp2 + req.body.otp3 + req.body.otp4;
      const verify = await verifyOtp.findOne({ Email: email });

      if (user && user.isBlocked) {
        req.flash('blocked', 'Your account is currently blocked. Please contact support.');
        return res.redirect(`/login`);
      } else if (verify) {
        const { otp: hashed } = verify;
        const compare = await bcrypt.compare(otp, hashed);
        console.log(compare);

        if (compare) {
          const user = await User.findOne({ email: email });

          if (user) {
            await User.findByIdAndUpdate({ _id: user._id }, { $set: { verified: true } });
            req.session.user = {
              _id: user._id,
              email: user.email,
              name: user.name,
            };

            await User.updateOne({ _id: user._id }, { $set: { session: true } });
            await verifyOtp.deleteOne({ email: email });
            res.redirect(`/`);
          } else {
            console.log('user not found');
          }
        } else {
          req.flash('incorrect', 'Please enter a valid OTP');
          res.redirect(`/otp?email=${email}`);
          console.log('OTP is incorrect');
        }
      } else {
        req.flash('expired', 'OTP expired. Please resend.');
        res.redirect(`/otp?email=${email}`);
        console.log('otp expired');
      }
    } catch (error) {
      console.error(error);
      req.flash('error', 'An error occurred. Please try again.');
      res.redirect(`/otp?email=${email}`);
    }
  };

  // Login with otp
  otpLogin = async (req, res) => {
    try {
      const email = req.query.email.trim();
      const otp1 = req.body.otp1.trim();
      const otp2 = req.body.otp2.trim();
      const otp3 = req.body.otp3.trim();
      const otp4 = req.body.otp4.trim();

      // Validate email and OTP presence
      if (!email || !otp1 || !otp2 || !otp3 || !otp4) {
        req.flash('error', 'Email and OTP are required');
        return res.redirect(`/otp?email=${email}&is=${true}`);
      }

      const user = await User.findOne({ email });

      if (!user) {
        req.flash('error', 'User not found');
        return res.redirect(`/login`);
      }

      if (user.isBlocked) {
        req.flash('blocked', 'Your account is currently blocked. Please contact support.');
        return res.redirect(`/login`);
      }

      const otp = otp1 + otp2 + otp3 + otp4;
      const find = await verifyOtp.findOne({ Email: email });

      if (!find) {
        req.flash('expired', 'OTP expired. Please resend OTP.');
        return res.redirect(`/otp?email=${email}&is=${true}`);
      }

      const compare = await bcrypt.compare(otp, find.otp);

      if (compare) {
        req.session.user = {
          _id: user._id,
          name: user.name,
          email: user.email,
        };
        res.redirect('/');
      } else {
        req.flash('incorrect', 'Enter a valid OTP.');
        res.redirect(`/otp?email=${email}&is=${true}`);
        console.log('OTP incorrect', 'from otp login');
      }
    } catch (error) {
      console.log(error);
      req.flash('error', 'An error occurred during OTP login');
      res.redirect(`/otp?email=${email}&is=${true}`);
    }
  };

  successGoogleLogin = async (req, res) => {
    const name = req.user.name.givenName;
    const email = req.user.email;
    const user = await User.findOne({ email }, {});
    if (user) {
      req.session.user = {
        _id: user._id,
        name: user.name,
        email: user.email,
      };
      return res.redirect('/');
    } else {
      const hashedPassword = ' ';
      const createNewUser = await User.create({
        name: name,
        email: email,
        password: hashedPassword,
      });
      req.session.user = {
        _id: createNewUser._id,
        name: createNewUser.name,
        email: createNewUser.email,
      };
      res.redirect('/');
    }
  };

  failureGoogleLogin = async (req, res) => {
    res.send('Error');
  };

  // user logout
  userLogout = async (req, res) => {
    try {
      req.session.user = null;
      res.redirect('/');
    } catch (error) {
      console.log(error);
    }
  };

  resend = async (req, res) => {
    try {
      const email = req.query.email;
      console.log(email);
      if (email) {
        await verifyOtp.deleteMany({ Email: email });
        await this.sentOtp(email);
        res.json({ ok: true });
      } else {
        console.log("Email is Doesn't Recived");
      }
    } catch (error) {
      console.log(error);
    }
  };

  // check session
  checkSession = (req, res) => {
    try {
      if (req.session) {
        res.json({ session: true });
      } else {
        res.json({ session: false });
      }
    } catch (error) {
      console.log(error);
    }
  };

  loadAbout = (req, res) => {
    try {
      res.render('aboutUs');
    } catch (error) { }
  };

  loadContact = (req, res) => {
    try {
      res.render('contact');
    } catch (error) { }
  };

  loadForget = (req, res) => {
    try {
      res.render('forgetPassword');
    } catch (error) {
      console.log(error);
    }
  };

  verifyUser = async (req, res) => {
    const { userId, token } = req.params;

    try {
      const user = await User.findById(userId);
      if (!user) {
        req.flash('blocked', 'Not Found This User');
        res.redirect('/forget-password');
      }
      console.log(user);
      // // Check if token matches and is not expired (implement expiration logic)
      // if (user.verificationToken !== token) {
      //   return res.status(401).json({ message: 'Invalid verification token' });
      // }

      // User verified, perform actions (e.g., set verified flag)
      res.render('forgetPasswordByUser', { user_id: user._id });
    } catch (error) {
      console.error(error);
      res.status(500);
    }
  };

  resetPassword = async (req, res) => {
    try {
      const { user_id, password } = req.body;

      if (!user_id || !password) {
        req.flash('error', 'Invalid request. Missing user ID or password.');
        return res.redirect('/forget-password');
      }

      const passHash = await bcrypt.hash(password, 10);

      const updatedData = await User.findByIdAndUpdate(
        { _id: user_id },
        { $set: { password: passHash } },
        { new: true, runValidators: true }, // Returns the updated document and runs validation
      );

      if (!updatedData) {
        req.flash('error', 'User not found or invalid user ID.');
        return res.redirect('/forget-password');
      }

      req.flash('pass', 'Password reset successfully');
      res.redirect('/login');
    } catch (error) {
      console.error('Error resetting password:', error);
      req.flash('error', 'An error occurred while resetting the password. Please try again.');
      res.redirect('/forget-password');
    }
  };

  forgetVerify = async (req, res) => {
    try {
      const email = req.body.email;
      const user = await User.findOne({ email: email });

      if (user) {
        const resetToken = this.generateResetToken();
        user.passwordResetToken = resetToken;
        await user.save();
        await this.sendVerificationEmail(user, resetToken);
        req.flash('pass', 'Password reset instructions sent to your email');
        res.redirect('/forget-password');
      } else {
        req.flash('blocked', 'Not Found This User');
        res.redirect('/forget-password');
      }
    } catch (error) {
      console.log(error);
    }
  };

  loadMyAccount = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      const userDetails = await User.findById({ _id: userId });
      const wallet = await Wallet.findOne({ user: userId });
      const walletBalance = wallet ? wallet.balance : 0;
      res.render('myAccount', { userDetails, walletBalance });
    } catch (error) {
      console.log(error);
    }
  };

  loadManageAddress = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      if (!userId) {
        return res.redirect('/login');
      }

      const wallet = await Wallet.findOne({ user: userId });
      const walletBalance = wallet ? wallet.balance : 0;

      const addresses = await Address.findOne({ user: userId });
      const addressList = addresses ? addresses.address : [];

      res.render('manageAddress', { address: addressList, walletBalance });
    } catch (error) {
      console.log(error);
      res.status(500).render('oops');
    }
  };

  editAddress = async (req, res) => {
    try {
      console.log(req.body);
      const userid = req.session.user?._id;
      const index = req.body.index;

      if (!userid) {
        console.log('user not found');
      }

      if (!index) {
        console.log('index not found');
      }

      const fullname = req.body.fname + ' ' + req.body.lname;

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

      await Address.findOneAndUpdate(
        { user: userid },
        {
          $set: {
            [`address.${index}`]: userAddress,
          },
        },
      );
      res.redirect('/manage-address');
    } catch (error) {
      console.log(error);
    }
  };

  deleteAddress = async (req, res) => {
    try {
      console.log('delete request');
      const { index } = req.params;
      const userId = req.session.user?._id;
      console.log(index);
      if (!index) {
        console.log('index not recived');
      }

      await Address.findOneAndUpdate(
        { user: userId },
        {
          $unset: {
            [`address.${index}`]: 1,
          },
        },
      );

      await Address.findOneAndUpdate(
        { user: userId },
        {
          $pull: {
            address: null,
          },
        },
      );
      res.status(200).json({ success: true });
    } catch (error) {
      console.log(error);
    }
  };

  changePassword = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      const { oldPassword, newPassword, confirmPassword } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User not found' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isOldPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
      if (!isOldPasswordCorrect) {
        return res.status(400).json({ error: 'Incorrect old password' });
      }

      if (oldPassword === newPassword) {
        return res.status(400).json({ error: 'New password cannot be the same as the old password' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New password and confirm password do not match' });
      }

      if (
        !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[a-zA-Z\d!@#$%^&*]{6,}$/.test(newPassword)
      ) {
        return res.status(400).json({ error: 'Password must be stronger' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      user.password = hashedPassword;
      await user.save();

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error changing password:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  personalDetails = async (req, res) => {
    try {
      const userId = req.session.user?._id;
      const { value, cls } = req.body;
      console.log(req.body);

      if (!userId) {
        return res.status(401).json({ success: false, error: 'User not logged in' });
      }

      if (cls === 'editUserName') {
        if (!/^\w+$/.test(value)) {
          return res.json({ success: false, message: 'Enter correct username (alphanumeric only)' });
        }

        const existingUser = await User.findOne({ name: value });
        if (existingUser) {
          return res.json({ success: false, message: 'Username already exists' });
        }

        await User.findByIdAndUpdate(
          { _id: userId },
          { $set: { name: value } }
        );

        // Update session data if needed
        if (req.session.user) req.session.user.name = value;

        return res.json({ success: true, message: 'Username successfully updated' });

      } else if (cls === 'editEmail') {
        if (value.indexOf('@') == -1 || !value.endsWith('gmail.com')) {
          return res.json({ success: false, message: 'Enter correct gmail address' });
        }

        const existingEmail = await User.findOne({ email: value });
        if (existingEmail) {
          return res.json({ success: false, message: 'Email already exists' });
        }

        await User.findByIdAndUpdate(
          { _id: userId },
          { $set: { email: value } }
        );

        // Update session data if needed
        if (req.session.user) req.session.user.email = value;

        return res.json({ success: true, message: 'Email successfully updated' });

      } else if (cls === 'editPhone') {
        if (value.trim().length < 10 || !/^\d+$/.test(value)) {
          return res.json({ success: false, message: 'Enter correct phone number' });
        }

        const existingPhone = await User.findOne({ mobile: value });
        if (existingPhone) {
          return res.json({ success: false, message: 'Phone number already exists' });
        }

        await User.findByIdAndUpdate(
          { _id: userId },
          { $set: { mobile: value } }
        );

        return res.json({ success: true, message: 'Phone number successfully updated' });
      }

      return res.json({ success: false, message: 'Invalid field' });

    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  transactionHistroy = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Number of transactions per page
    const skip = (page - 1) * limit;

    try {
      // Find the wallet for the authenticated user
      const wallet = await Wallet.findOne({ user: req.session.user?._id });

      if (!wallet) {
        console.log('Wallet not found for user:', req.session.user?._id);
        return res.status(404).send('Wallet not found');
      }

      // Get the total number of transactions for pagination
      const totalTransactions = wallet.transactions.length;

      // Reverse the transactions to show the latest one first
      const reversedTransactions = wallet.transactions.reverse();

      // Get the transactions for the current page
      const transactions = reversedTransactions.slice(skip, skip + limit);

      const totalPages = Math.ceil(totalTransactions / limit);

      console.log('Transactions:', transactions);
      console.log('Current Page:', page, 'Total Pages:', totalPages);

      res.render('transactions', {
        transactions: transactions,
        currentPage: page,
        totalPages: totalPages,
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).send('Error fetching transactions');
    }
  };
}

module.exports = new UserController();
