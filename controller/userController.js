const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const verifyOtp = require("../models/otpVerification");
const Product = require("../models/product");
require("dotenv").config();


// load home page
module.exports.loadHome = async (req, res) => {
  try {
    const product = await Product.find({ isListed: true }).populate("cetagory");

    if (product) {
      res.render("home", { product: product ,title:"Zay fashion"});
    }
  } catch (error) {
    console.log(error);
  }
};

// ================================== User login ===============================================\\

// load login page
module.exports.loadLogin = (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    console.log(error);
  }
};

module.exports.userLogin = async (req, res) => {
  try {
    const email = req.body.email;
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      if (user.verified) {
        if (user.isBlocked) {
          req.flash("blocked", "You are blocked by admin");
          res.redirect("/login");
          console.log("User is blocked");
        } else {
          const enteredPass = req.body.password;
          const databasePass = user.password;
          const pass = await bcrypt.compare(enteredPass, databasePass);
          console.log(pass);
          if (pass) {
            req.session.user = {
              _id: user._id,
              name: user.name,
              email: user.email,
            };

            res.redirect(`/`);
          } else {
            req.flash("pass", "Enter correct password");
            res.redirect("/login");
            console.log("enter correct password");
          }
        }
      } else {
        res.redirect(`/otp?email=${email}&is=${true}&first=${true}`);
        console.log("user not verified");
      }
    } else {
      req.flash("found", "Email not found");
      res.redirect("/login");
      console.log("user not found");
    }
  } catch (error) {
    console.log(error);
  }
};

// ======================================Ueser sign UP and otp verification ==============================================  \\

// load sign up page
module.exports.loadRegister = (req, res) => {
  try {
    res.render("register");
  } catch (error) {
    console.log(error);
  }
};

// register user
module.exports.insertUser = async (req, res) => {
  try {
    const uname = await User.findOne({ name: req.body.uname });
    const email = await User.findOne({ email: req.body.email });

    if (uname) {
      req.flash("uname", "Username already exists");
      res.redirect("/signUp");
    } else if (email) {
      req.flash("email", "Email already exists");
      res.redirect("/signUp");
    } else {
      const passHash = await bcrypt.hash(req.body.password, 10);

      const user = new User({
        name: req.body.uname,
        email: req.body.email,
        mobile: req.body.phone,
        password: passHash,
        isAdmin: false,
        isBlocked: false,
        verified: false,
      });

      const save = await user.save();
      // console.log(user.email);
      if (save) {
        sentOtp(user.email);
        res.redirect(`/otp?email=${user.email}`);
      } else {
        console.log("not saved....");
      }
    }
  } catch (error) {
    console.log(error);
  }
};

// sent otp and load otp page

const sentOtp = async (email) => {
  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.USER_AUTH,
        pass: process.env.USER_AUTH_PASS,

      },
    });

    const createdOTP = `${Math.floor(1000 + Math.random() * 9000)}`;

    const mailOption = {
      from: "gibmepreo@gmail.com",
      to: email,
      subject: "OTP Verification",
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
    console.log(req.query.is, "is");
    if (req.query.is && req.query.first) {
      sentOtp(req.query.email);
    }
    console.log(req.query.email);
    const email = req.query.email || "******gmail.com";

    const user1 = await User.findOne({ email: email });
    console.log(user1);
    const verify = user1.verified;
    console.log(verify);
    res.render("otp", { email: email, verify: verify });
  } catch (error) {
    console.log(error);
  }
};

// load login with otp page

module.exports.OTPlogin = (req, res) => {
  try {
    res.render("otpLogin");
  } catch (error) {
    console.log(error);
  }
};

module.exports.verifyOTP = async (req, res) => {
  try {
    const email = req.query.email;
    console.log("otp verify email", email);

    // Check for blocked user before OTP verification
    const user = await User.findOne({ email: email });
    if (user && user.isBlocked) {
      req.flash("blocked", "Your account is currently blocked. Please contact support.");
      return res.redirect(`/login`); // Replace with your login page path
    }

    const otp = req.body.otp1 + req.body.otp2 + req.body.otp3 + req.body.otp4;

    const verify = await verifyOtp.findOne({ Email: email });

    if (verify) {
      const { otp: hashed } = verify;
      const compare = await bcrypt.compare(otp, hashed);
      console.log(compare);

      if (compare) {
        const user = await User.findOne({ email: email });

        if (user) {
          await User.findByIdAndUpdate(
            { _id: user._id },
            { $set: { verified: true } }
          );
          req.session.user = {
            _id: user._id,
            email: user.email,
            name: user.name,
          };

          await User.updateOne({ _id: user._id }, { $set: { session: true } });
          await verifyOtp.deleteOne({ email: email });
          res.redirect(`/`);
        } else {
          console.log("user not found");
        }
      } else {
        req.flash("incorrect", "Please enter a valid OTP");
        res.redirect(`/otp?email=${email}`);
        console.log("OTP is incorrect");
      }
    } else {
      req.flash("expired", "OTP expired. Please resend.");
      res.redirect(`/otp?email=${email}`);
      console.log("otp expired");
    }
  } catch (error) {
    console.error(error);
    req.flash("error", "An error occurred. Please try again."); // Generic error message
    res.redirect(`/otp?email=${email}`);
  }
};


// Login with otp
module.exports.otpLogin = async (req, res) => {
  try {
    const email = req.query.email;
    console.log(email);

    const otp = req.body.otp1 + req.body.otp2 + req.body.otp3 + req.body.otp4;
    const find = await verifyOtp.findOne({ Email: email });

    if (find) {
      const compare = await bcrypt.compare(otp, find.otp);
      const user = await User.findOne({ email: email });
      if (compare) {
        req.session.user = {
          _id: user._id,
          name: user.name,
          email: user.email,
        };

        res.redirect("/");
      } else {
        req.flash("incorrect", "Enter valid otp");
        res.redirect(`/otp?email=${email}&is=${true}`);
        console.log("OTP incorrect", "from otp login");
      }
    } else {
      req.flash("expired", "OTP expired resend otp");
      res.redirect(`/otp?email=${email}&is=${true}`);
      console.log("otp expired", "from otp login");
    }
  } catch (error) {
    console.log(error);
  }
};

//the success route control of google auth
module.exports.successGoogleLogin = async (req,res)=>{
  const name = req.user.name.givenName
	const email = req.user.email;
  const user = await User.findOne({ email }, {});
  if (user) {
		req.session.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
    };
		return res.redirect('/');
	}else{
    const hashedPassword = ' ';
    const createNewUser = await User.create({
      name:name,
			email: email,
			password: hashedPassword
		});
    req.session.user = {
      _id: createNewUser._id,
      name: user.name,
      email: user.email,
    };
    res.redirect('/');
  }
}

//google auth failure route controller
module.exports.failureGoogleLogin = async (req,res)=>{
  res.send("Error"); 
}
// ============================================ User sign up ends =============================================\\

// user logout
module.exports.userLogout = async (req, res) => {
  try {
    req.session.user = null;
    res.redirect("/");
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
    res.render("aboutUs");
  } catch (error) {}
};

module.exports.loadContact = (req, res) => {
  try {
    res.render("contact");
  } catch (error) {}
};

//load forget password page
module.exports.loadForget = (req,res)=>{
  try {
    res.render('forgetPassword')
  } catch (error) {
    console.log(error)
  }
}

// Function to generate a random reset token
function generateResetToken() {
  return Math.random().toString(20).substring(2, 12); // Example for illustration
}

async function sendVerificationEmail(user, token) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.USER_AUTH,
      pass: process.env.USER_AUTH_PASS
    }
  });

  const mailOptions = {
    from: process.env.USER_AUTH,
    to: user.email,
    subject: 'Account Verification',
    html: `
      <p>Click on the link below to verify your account:</p>
      <a href="http://localhost:3000/change-password/${user._id}/${token}">Verify Account</a>
    `
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
      req.flash("blocked", "Not Found This User");
      res.redirect('/forget-password')
    }
    console.log(user)
    // // Check if token matches and is not expired (implement expiration logic)
    // if (user.verificationToken !== token) {
    //   return res.status(401).json({ message: 'Invalid verification token' });
    // }

    // User verified, perform actions (e.g., set verified flag)
    res.render('forgetPasswordByUser', { user_id:user._id }); 
  } catch (error) {
    console.error(error);
    res.status(500)
  }
};

module.exports.resetPassword = async(req,res)=>{
  try {
    const user_id = req.body.user_id;
    const passHash = await bcrypt.hash(req.body.password, 10);
    const updatedData = await User.findByIdAndUpdate({_id:user_id},{$set:{password:passHash}})
    req.flash("pass","password reset successfully");
    res.redirect('/login')
  } catch (error) {
    console.log(error)
  }
}

module.exports.forgetVerify = async(req,res)=>{
  try {
    const email = req.body.email
    const user = await User.findOne({email:email})
    
    if(user){
      const resetToken = generateResetToken();
      user.passwordResetToken = resetToken;
      await user.save();
      await sendVerificationEmail(user, resetToken);
      req.flash("pass","Password reset instructions sent to your email");
      res.redirect('/forget-password')
    }else{
      req.flash("blocked", "Not Found This User");
      res.redirect('/forget-password')
    }
  } catch (error) {
    console.log(error)
  }
}


//user details
module.exports.loadMyAccount = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const userDetails = await User.findById({ _id: userId });
    res.render("myAccount", { userDetails });
  } catch (error) {
    console.log(error);
  }
};