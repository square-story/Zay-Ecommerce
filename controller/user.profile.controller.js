import User from '../models/user.model.js';
import Wallet from '../models/wallet.model.js';
import bcrypt from 'bcrypt';

class UserProfileController {
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

export default new UserProfileController();
