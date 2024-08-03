const User = require('../models/userModel');
const Wallet = require('../models/walletModel');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const verifyOtp = require('../models/otpVerification');
const Product = require('../models/product');
const Address = require('../models/address');
const Review = require('../models/reviewModal');
require('dotenv').config();

// load home page
module.exports.loadHome = async (req, res) => {
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

// ================================== User login ===============================================\\

// load login page
module.exports.loadLogin = (req, res) => {
  try {
    const message = req.query.message;
    res.render('login', { message });
  } catch (error) {
    console.log(error);
  }
};

module.exports.userLogin = async (req, res) => {
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

// ======================================Ueser sign UP and otp verification ==============================================  \\

// load sign up page
module.exports.loadRegister = (req, res) => {
  try {
    res.render('register');
  } catch (error) {
    console.log(error);
  }
};

// register user
module.exports.insertUser = async (req, res) => {
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
      req.flash(
        'password',
        'Password must be at least 6 characters long, contain at least one uppercase letter, and one special character',
      );
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
      sentOtp(user.email);
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

// sent otp and load otp page

const sentOtp = async (email) => {
  try {
    const transport = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.USER_AUTH,
        pass: process.env.USER_AUTH_PASS,
      },
    });

    const createdOTP = `${Math.floor(1000 + Math.random() * 9000)}`;

    const mailOption = {
      from: process.env.USER_AUTH,
      to: email,
      subject: 'OTP Verification',
      html: `Your otp is ${createdOTP}`,
    };

    await transport.sendMail(mailOption);
    const hashOTP = await bcrypt.hash(createdOTP, 10);

    const otp = new verifyOtp({
      Email: email,
      otp: hashOTP,
    });

    await otp.save();
    // const isSave = await otp.save();

    // if(isSave) {

    // }
  } catch (error) {
    console.log(error);
  }
};

// load otp page
module.exports.loadotp = async (req, res) => {
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

// load login with otp page

module.exports.OTPlogin = (req, res) => {
  try {
    res.render('otpLogin');
  } catch (error) {
    console.log(error);
  }
};

module.exports.verifyOTP = async (req, res) => {
  try {
    const email = req.query.email;
    console.log('otp verify email', email);
    const user = await User.findOne({ email: email });
    const otp = req.body.otp1 + req.body.otp2 + req.body.otp3 + req.body.otp4;
    const verify = await verifyOtp.findOne({ Email: email });

    if (user && user.isBlocked) {
      req.flash('blocked', 'Your account is currently blocked. Please contact support.');
      return res.redirect(`/login`); // Replace with your login page path
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
    req.flash('error', 'An error occurred. Please try again.'); // Generic error message
    res.redirect(`/otp?email=${email}`);
  }
};

// Login with otp
module.exports.otpLogin = async (req, res) => {
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

//the success route control of google auth
module.exports.successGoogleLogin = async (req, res) => {
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
      name: user.name,
      email: user.email,
    };
    res.redirect('/');
  }
};

//google auth failure route controller
module.exports.failureGoogleLogin = async (req, res) => {
  res.send('Error');
};
// ============================================ User sign up ends =============================================\\

// user logout
module.exports.userLogout = async (req, res) => {
  try {
    req.session.user = null;
    res.redirect('/');
  } catch (error) {
    console.log(error);
  }
};

module.exports.resend = async (req, res) => {
  try {
    const email = req.query.email;
    console.log(email);
    if (email) {
      await verifyOtp.deleteMany({ Email: email });
      sentOtp(email);
      res.json({ ok: true });
    } else {
      console.log("Email is Doesn't Recived");
    }
  } catch (error) {
    console.log(error);
  }
};

// check session
module.exports.checkSession = (req, res) => {
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

module.exports.loadAbout = (req, res) => {
  try {
    res.render('aboutUs');
  } catch (error) {}
};

module.exports.loadContact = (req, res) => {
  try {
    res.render('contact');
  } catch (error) {}
};

//load forget password page
module.exports.loadForget = (req, res) => {
  try {
    res.render('forgetPassword');
  } catch (error) {
    console.log(error);
  }
};

// Function to generate a random reset token
function generateResetToken() {
  return Math.random().toString(20).substring(2, 12); // Example for illustration
}

async function sendVerificationEmail(user, token) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.USER_AUTH,
      pass: process.env.USER_AUTH_PASS,
    },
  });

  const mailOptions = {
    from: process.env.USER_AUTH,
    to: user.email,
    subject: 'Account Verification',
    html: `
      <p>Click on the link below to verify your account:</p>
      <a href="http://localhost:3000/change-password/${user._id}/${token}">Verify Account</a>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Verification email sent to:', user.email);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// User verification controller
exports.verifyUser = async (req, res) => {
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

module.exports.resetPassword = async (req, res) => {
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

module.exports.forgetVerify = async (req, res) => {
  try {
    const email = req.body.email;
    const user = await User.findOne({ email: email });

    if (user) {
      const resetToken = generateResetToken();
      user.passwordResetToken = resetToken;
      await user.save();
      await sendVerificationEmail(user, resetToken);
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

//user details
module.exports.loadMyAccount = async (req, res) => {
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

module.exports.loadManageAddress = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      // res.status(500).render('opps');
    }
    const wallet = await Wallet.findOne({ user: userId });
    const walletBalance = wallet ? wallet.balance : 0;
    const addresses = await Address.findOne({ user: userId });
    if (!addresses) {
      // res.status(404).render('oops');
    }
    res.render('manageAddress', { address: addresses.address, walletBalance });
  } catch (error) {
    console.log(error);
    // res.status(404).render('oops');
  }
};

module.exports.editAddress = async (req, res) => {
  try {
    console.log(req.body);
    const userid = req.session.user?._id;
    const index = req.body.index;

    if (!userid) {
      //    res.status(500).render('oops');
      console.log('user not found');
    }

    if (!index) {
      // res.status(500).render('oops');
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
    //  res.status(500).render('oops');
    console.log(error);
  }
};

module.exports.deleteAddress = async (req, res) => {
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

module.exports.changePassword = async (req, res) => {
  try {
    console.log('Starting password change process');

    const userId = req.session.user?._id;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    console.log(req.body);

    if (!userId) {
      return res.status(400).send('User not found');
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

module.exports.personalDetails = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const { value, cls } = req.body;
    console.log(req.body);
    if (!userId) {
      res.redirect('/');
    }

    if (cls === 'editUserName') {
      if (!/^\w+$/.test(value)) {
        res.json({ username: true, massage: 'enter correct username' });
      } else {
        const username = await User.findOne({ name: value });

        if (username) {
          res.json({ username: true, massage: 'username alreay exist' });
        } else {
          const username = await User.findByIdAndUpdate(
            { _id: userId },
            {
              $set: {
                name: value,
              },
            },
          );
          if (username) {
            return res.json({
              success: true,
              massage: 'username successfully updated',
            });
          }
        }
      }
    } else if (cls === 'editEmail') {
      if (value.indexOf('@') == -1 || !value.endsWith('gmail.com')) {
        res.json({ email: true, massage: 'enter correct email' });
      } else {
        const email = await User.findOne({ email: value });

        if (email) {
          res.json({ email: true, massage: 'email already exist' });
        } else {
          const username = await User.findByIdAndUpdate(
            { _id: userId },
            {
              $set: {
                email: value,
              },
            },
          );
          if (username) {
            return res.json({
              success: true,
              massage: 'email successfully updated',
            });
          }
        }
      }
    } else if (cls === 'editPhone') {
      if (value.trim().length < 10 || !/^\d+$/.test(value)) {
        res.json({ phone: true, massage: 'enter correct phone number' });
      } else {
        const phone = await User.findOne({ mobile: value });

        if (phone) {
          res.json({ phone: true, massage: 'phone number alreay exist' });
        } else {
          const username = await User.findByIdAndUpdate(
            { _id: userId },
            {
              $set: {
                mobile: value,
              },
            },
          );
          if (username) {
            return res.json({
              success: true,
              massage: 'phone number successfully updated',
            });
          }
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports.transactionHistroy = async (req, res) => {
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

    // Get the transactions for the current page
    const transactions = wallet.transactions.slice(skip, skip + limit);

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
