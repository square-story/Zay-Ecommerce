import Address from '../models/address.model.js';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import Review from '../models/review.model.js';
import Wallet from '../models/wallet.model.js';
import Coupon from '../models/coupon.model.js';
import { updateWallet } from './wallet.controller.js';

class OrderManagementController {
    loadMyOrder = async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 0;
            const limit = 4; // Set the limit of orders per page
            const userid = req.session.user?._id;
            const wallet = await Wallet.findOne({ user: userid });
            const walletBalance = wallet ? wallet.balance : 0;
            if (!userid) {
                return res.redirect('/login'); // Redirect to login if the user is not logged in
            }

            const orderLength = await Order.countDocuments({ user: userid });
            const orders = await Order.find({
                user: userid,
                status: { $nin: ['pending'] },
            })
                .populate('user')
                .sort({ date: -1 }) // Ensure orders are sorted by creation date
                .skip(page * limit)
                .limit(limit);

            res.render('myOrder', {
                orders,
                page,
                limit,
                orderLength,
                walletBalance,
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    };

    addAddress = async (req, res) => {
        try {
            console.log(req.body);
            const userid = req.session.user?._id;

            if (userid) {
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

                const ad = await Address.findOne({ user: userid });

                if (ad) {
                    await Address.updateOne(
                        { user: userid },
                        {
                            $push: {
                                address: userAddress,
                            },
                        },
                    );
                } else {
                    const address = new Address({
                        user: userid,
                        address: userAddress,
                    });

                    await address.save();
                }

                req.body.account ? res.redirect('/manage-address') : res.redirect('/check-out');
            } else {
                console.log('id didt recived');
            }
        } catch (error) {
            console.log(error);
        }
    };

    loadOrderSucces = (req, res) => {
        try {
            const orderStatus = req.query.status; // 'success' or 'failure'
            const orderNumber = this.generateOrderNumber();
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 7); // Estimated delivery in 7 days

            res.render('order-status', {
                orderStatus,
                orderNumber,
                deliveryDate: deliveryDate.toDateString(),
            });
        } catch (error) {
            console.log(error);
        }
    };

    orderCancellation = async (req, res) => {
        try {
            const { orderId, productId, index, cancelReason } = req.body;
            const userId = req.session.user?._id;

            if (!userId) {
                return res.status(400).json({ error: 'User not logged in' });
            }

            // Fetch the order
            const order = await Order.findById(orderId);

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            const orderProduct = order.products[index];

            // Check if checks are needed (e.g. is it already canceled?)
            if (orderProduct.status === 'canceled') {
                return res.status(400).json({ success: false, message: 'Product already canceled' });
            }

            // Update the product status to canceled
            await Order.findByIdAndUpdate(
                { _id: orderId, 'products.productId': productId },
                {
                    $set: {
                        [`products.${index}.cancelRequest`]: 'accepted', // Auto-accept
                        [`products.${index}.cancelReason`]: cancelReason,
                        [`products.${index}.status`]: 'canceled',
                    },
                },
                {
                    new: true,
                },
            );

            // Adjust the stock for the canceled product
            const quantity = orderProduct.quantity;
            await Product.findOneAndUpdate(
                { _id: productId },
                {
                    $inc: {
                        [`variant.${orderProduct.product}.stock`]: quantity,
                    },
                },
            );

            const remainingTotal = order.products
                .filter((prod, i) => i != index && prod.status !== 'canceled') // i != index because we just canceled it
                .reduce((sum, prod) => sum + prod.totalPrice, 0);

            let refundAmount = orderProduct.totalPrice;

            // If there's a coupon applied and the remaining total doesn't meet the minimum required amount
            if (order.couponCode && remainingTotal < order.couponMinimumAmount) {
                refundAmount -= order.discountedAmount;
            }

            // Round the refund amount to 2 decimal places
            refundAmount = parseFloat(refundAmount.toFixed(2));

            // Refund amount to wallet or initiate Razorpay refund if applicable
            // Only if payment was completed.
            if (
                (order.paymentMethod === 'wallet' || order.paymentMethod === 'razorpay') &&
                order.paymentStatus === 'completed'
            ) {
                await updateWallet(
                    userId,
                    refundAmount,
                    'credit',
                    `Order Cancelled - Order id:${orderId.toString().slice(-6).toUpperCase()}`,
                );
            }

            // If the coupon was applied and removed, update the coupon's usage
            if (order.couponCode && remainingTotal < order.couponMinimumAmount) {
                await Coupon.findOneAndUpdate(
                    { couponCode: order.couponCode },
                    { $pull: { userUsed: userId } },
                );
            }

            // Check if all products in the order are canceled/returned
            const allProductsCanceled = order.products.every((prod, i) => {
                if (i == index) return true; // The one we just canceled
                return prod.status === 'canceled';
            });

            // If all products are canceled, update the order status
            if (allProductsCanceled) {
                await Order.findByIdAndUpdate(orderId, {
                    $set: { status: 'returned' },
                });
            }

            res.json({
                success: true,
                message: 'Order canceled successfully',
            });
        } catch (error) {
            console.error('Error cancelling order:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    productReturn = async (req, res) => {
        try {
            const { orderId, productId, index, returnReason } = req.body;
            const userId = req.session.user?._id;

            if (!userId) {
                return res.status(400).json({ error: 'User not logged in' });
            }

            // Update order status and request return
            await Order.findOneAndUpdate(
                { _id: orderId, 'products.productId': productId },
                {
                    $set: {
                        [`products.${index}.returnRequest`]: 'requested',
                        [`products.${index}.returnReason`]: returnReason,
                    },
                },
            );
            res.json({ success: true, message: 'Return request sent successfully' });
        } catch (error) {
            console.error('Error returning product:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    getOrderDetails = async (req, res) => {
        try {
            const orderId = req.query.orderId;
            if (!orderId) {
                return res.status(400).send('Order ID is required');
            }

            const order = await Order.findById(orderId).populate('user').populate('products.productId');

            if (!order) {
                return res.status(404).send('Order not found');
            }

            res.render('singleOrderDetails', { order });
        } catch (error) {
            console.error(error);
            res.status(500).send('Server Error');
        }
    };

    loadSingleProduct = async (req, res) => {
        try {
            console.log(req.query);
            const userId = req.session.user?._id;
            const { productId, index, size, orderId } = req.query;
            const detials = await Order.findOne({ _id: orderId, user: userId })
                .populate('user')
                .populate('products.productId');
            const product = detials.products.find((pro, i) => i === parseInt(index));
            const review = await Review.findOne({ user: userId, productId: productId });
            res.render('singleProduct', {
                product: product,
                address: detials.deliveryDetails,
                review: review,
                orderId: orderId,
                index: index,
                order: detials,
            });
        } catch (error) {
            console.log(error);
        }
    };

    generateOrderNumber() {
        const prefix = 'ORD';
        const randomNumber = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit random number
        return `${prefix}${randomNumber}`;
    }
}

export default new OrderManagementController();
