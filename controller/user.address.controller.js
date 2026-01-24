import Address from '../models/address.model.js';
import Wallet from '../models/wallet.model.js';

class UserAddressController {
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
}

export default new UserAddressController();
