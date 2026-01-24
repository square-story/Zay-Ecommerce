import Address from '../models/address.model.js';
import Cart from '../models/cart.model.js';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import Coupon from '../models/coupon.model.js';
import { updateWallet } from './wallet.controller.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

class OrderPlacementController {
    constructor() {
        this.razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }

    placeOrder = async (req, res) => {
        try {
            const userId = req.session.user?._id;
            if (!userId) {
                return res.status(400).json({ error: 'User not logged in' });
            }

            const { index, payment_method, subtotal: subtotalStr, isCoupon } = req.body;
            const subtotal = parseFloat(subtotalStr);
            if (isNaN(subtotal)) {
                return res.status(400).json({ error: 'Invalid subtotal value' });
            }

            let cart = await Cart.findOne({ user: userId }).populate('products.productId');
            if (!cart) {
                return res.status(400).json({ error: 'Cart not found for user' });
            }
            const products = cart.products;

            const addresses = await Address.findOne({ user: userId }, { address: 1 });
            if (!addresses) {
                return res.status(400).json({ error: 'No addresses found for user' });
            }

            const selectedAddress = addresses.address[index];
            if (!selectedAddress) {
                return res.status(400).json({ error: 'Address not found' });
            }

            // Check stock availability for each product variant in the cart
            const outOfStockProducts = [];
            for (let product of products) {
                const variantIndex = product.product;
                if (!variantIndex || variantIndex >= product.productId.variant.length) {
                    return res.status(400).json({ error: 'Invalid product variant index' });
                }
                const productVariant = product.productId.variant[variantIndex];
                const requestedQuantity = product.quantity;
                if (!productVariant || !productVariant.stock || productVariant.stock < requestedQuantity) {
                    outOfStockProducts.push({
                        productName: product.productId.name,
                        variantDetails: productVariant,
                    });
                }
            }
            if (outOfStockProducts.length > 0) {
                return res.status(400).json({ error: 'Some products are out of stock', outOfStockProducts });
            }

            let deliveryCharge = subtotal < 500 ? 80 : 0;
            let discount = 0;
            let couponCode = null;
            let couponMinimumAmount;
            const total = cart.products.reduce((acc, crr) => acc + crr.totalPrice, 0);

            if (isCoupon) {
                const coupon = await Coupon.findOne({ couponCode: isCoupon });
                if (coupon && coupon.limit >= coupon.userUsed.length) {
                    // Calculate total discount
                    discount = Math.round((coupon.percentage / 100) * total || 0);
                    if (coupon.maxDiscountAmount) {
                        discount = Math.min(discount, coupon.maxDiscountAmount);
                    }

                    // Apply discount to products proportionally
                    const totalProductPrice = products.reduce((sum, product) => sum + product.totalPrice, 0);
                    const discountPerProduct = discount / totalProductPrice;

                    for (let product of products) {
                        const productDiscount = product.totalPrice * discountPerProduct;
                        product.totalPrice -= productDiscount;
                        product.coupon = productDiscount; // Store the discount applied to this product
                    }
                    couponMinimumAmount = coupon.minimumOrderValue;
                    coupon.userUsed.push(userId);
                    await coupon.save();
                } else {
                    return res.json({ fail: true, message: 'Coupon limit exceeds or invalid coupon' });
                }
            }

            const totalAmount = products.reduce((sum, product) => sum + product.totalPrice, 0);
            const finalAmount = totalAmount + deliveryCharge;

            // Create Razorpay order if needed
            let razorpayOrder = null;
            if (payment_method === 'razorpay') {
                const options = {
                    amount: finalAmount * 100, // Amount in paisa
                    currency: 'INR',
                    receipt: `order_rcptid_${Date.now()}`,
                };
                razorpayOrder = await this.razorpay.orders.create(options);
            }

            // Create order in database
            const order = new Order({
                user: userId,
                deliveryDetails: selectedAddress,
                products: products,
                totalAmount: finalAmount,
                discountedAmount: discount, // Save the total discount applied
                date: new Date(),
                expected_delivery: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                status: payment_method === 'COD' ? 'placed' : 'pending',
                paymentMethod: payment_method,
                razorpayOrderId: razorpayOrder ? razorpayOrder.id : null,
                paymentStatus: payment_method === 'COD' ? 'completed' : 'pending',
                couponCode, // Save the coupon code used
                couponMinimumAmount,
            });

            const orderDetails = await order.save();
            const orderId = orderDetails._id;

            switch (payment_method) {
                case 'COD':
                    await this.handleCOD(orderDetails, userId, products);
                    res.json({ success: true });
                    break;
                case 'wallet':
                    const walletResult = await this.handleWalletPayment(userId, finalAmount, orderId);
                    if (walletResult.success) {
                        // Reduce product quantities after successful wallet payment
                        for (const product of products) {
                            const productId = product.productId;
                            const variantIndex = product.product;
                            const productQuantity = product.quantity;
                            await Product.updateOne(
                                { _id: productId },
                                { $inc: { [`variant.${variantIndex}.stock`]: -productQuantity } },
                            );
                        }

                        // Clear user's cart after successful order placement
                        await Cart.deleteOne({ user: userId });

                        // Update order status to "placed"
                        order.status = 'placed';
                        order.paymentStatus = 'completed';
                        await order.save();

                        res.json({ success: true });
                    } else {
                        res.json({ success: false, message: 'Insufficient wallet balance' });
                    }
                    break;
                case 'razorpay':
                    res.json({
                        success: true,
                        orderId: orderId,
                        razorpayOrderId: razorpayOrder.id,
                        amount: finalAmount,
                        key: process.env.RAZORPAY_KEY_ID,
                    });
                    break;
                default:
                    res.status(400).json({ error: 'Invalid payment method' });
                    break;
            }
        } catch (error) {
            console.error('Error placing order:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    handlePaymentFailure = async (req, res) => {
        try {
            const { orderId } = req.body;
            if (!orderId) {
                return res.status(400).json({ error: 'Order ID not provided' });
            }

            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(400).json({ error: 'Order not found' });
            }

            if (order.status !== 'pending') {
                return res.status(400).json({ error: 'Order is not in pending state' });
            }

            // Update order status to "failed"
            order.status = 'failed';
            await order.save();

            res.json({ success: true });
        } catch (error) {
            console.error('Error handling payment failure:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    verifyPayment = async (req, res) => {
        try {
            const { payment_id, order_id, signature, status, reason } = req.body;
            const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
            hmac.update(order_id + '|' + payment_id);
            const generatedSignature = hmac.digest('hex');

            if (status === 'failed') {
                // Update order status to "failed"
                console.log('failed message content: ', req.body);
                const order = await Order.findOne({ razorpayOrderId: order_id });
                console.log('this is from order order failed to check the coupon applied : ', order);
                if (order) {
                    const coupon = await Coupon.findOne({ couponCode: order.couponCode });
                    console.log('hello from coupon opened :', coupon);
                    if (coupon) {
                        coupon.userUsed = coupon.userUsed.filter(
                            (userId) => userId.toString() !== order.user.toString(),
                        );
                        await coupon.save();
                    }
                }
                await Order.updateOne(
                    { razorpayOrderId: order_id },
                    { status: 'failed', failureReason: reason, paymentStatus: 'failed' },
                );
                await this.handleCOD(order, order.user, order.products);
                // Send response
                return res.json({
                    success: false,
                    message: 'Payment failed. Please try again.',
                });
            }

            if (generatedSignature === signature) {
                const order = await Order.findOne({ razorpayOrderId: order_id });
                if (!order) {
                    return res.status(400).json({ success: false, message: 'Order not found' });
                }

                order.status = 'placed';
                order.paymentStatus = 'completed';
                await order.save();

                await this.handleCOD(order, order.user, order.products);

                res.json({ success: true, orderId: order._id });
            } else {
                res.status(400).json({ success: false, message: 'Payment verification failed' });
            }
        } catch (error) {
            console.error('Error verifying payment:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    retryPayment = async (req, res) => {
        try {
            const { orderId } = req.body;
            const order = await Order.findById(orderId);

            if (!order) {
                return res.status(400).json({ success: false, message: 'Order not found' });
            }

            // Create a new Razorpay order
            const options = {
                amount: order.totalAmount * 100, // Amount in paisa
                currency: 'INR',
                receipt: `order_rcptid_${Date.now()}`,
            };

            const razorpayOrder = await this.razorpay.orders.create(options);

            // Update the order with the new Razorpay order ID
            order.razorpayOrderId = razorpayOrder.id;
            await order.save();

            res.json({
                success: true,
                razorpayOrderId: razorpayOrder.id,
                key: process.env.RAZORPAY_KEY_ID,
            });
        } catch (error) {
            console.error('Error retrying payment:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    };

    // Helper Methods
    handleCOD = async (orderDetails, userId, products) => {
        await Cart.deleteOne({ user: userId });
        for (let product of products) {
            const productId = product.productId;
            const variantIndex = product.product;
            const productQuantity = product.quantity;
            await Product.updateOne(
                { _id: productId },
                { $inc: { [`variant.${variantIndex}.stock`]: -productQuantity } },
            );
        }
    };

    handleWalletPayment = async (userId, finalAmount, orderId) => {
        const result = await updateWallet(
            userId,
            finalAmount,
            'debit',
            `Order Payment - Order id:${orderId.toString().slice(-6).toUpperCase()}`,
        );
        return result;
    };
}

export default new OrderPlacementController();
