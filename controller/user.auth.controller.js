import User from '../models/user.model.js';
import Wallet from '../models/wallet.model.js';
import bcrypt from 'bcrypt';
import verifyOtp from '../models/otp.verification.model.js';
import { sentOtp } from '../helpers/send.otp.helper.js';
import { generateResetToken } from '../helpers/reset.token.generation.helper.js';
import { sendVerificationEmail } from '../helpers/verification.mail.helper.js';
import dotenv from 'dotenv';
dotenv.config();

class UserAuthController {
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
                await sentOtp(user.email);
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
            await sentOtp(email);

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
                await sentOtp(email);
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
}

export default new UserAuthController();
