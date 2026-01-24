import Order from "../models/order.model.js";
import Coupon from "../models/coupon.model.js";
import product from "../models/product.model.js";
import { updateWallet } from "./wallet.controller.js";

class ReturnController {
    loadReturns = async (req, res) => {
        try {
            const order = await Order.find({ 'products.returnRequest': 'requested' })
                .populate('user')
                .populate('products.productId');
            res.render('returnRequest', { order: order });
        } catch (error) {
            console.log(error);
        }
    };

    returns = async (req, res) => {
        console.log('returns');
        try {
            const { orderId, productId, index, decision } = req.body;

            if (decision === 'accepted') {
                // Fetch the order
                const order = await Order.findById(orderId);

                if (!order) {
                    return res.status(404).json({ success: false, message: 'Order not found' });
                }

                const userId = order.user;
                const orderProduct = order.products[index];
                const appliedCoupon = order.couponCode
                    ? await Coupon.findOne({ couponCode: order.couponCode })
                    : null;

                // Update the product status to returned
                await Order.findByIdAndUpdate(
                    { _id: orderId, 'products.productId': productId },
                    {
                        $set: {
                            [`products.${index}.returnRequest`]: decision,
                            [`products.${index}.status`]: 'returned',
                        },
                    },
                    {
                        new: true,
                    },
                );

                // Adjust the stock for the returned product
                const quantity = orderProduct.quantity;
                await product.findOneAndUpdate(
                    { _id: productId },
                    {
                        $inc: {
                            [`variant.${index}.stock`]: quantity,
                        },
                    },
                );

                // Calculate the remaining total amount after this product's return
                const remainingTotal = order.products
                    .filter((prod, i) => i !== index && prod.status !== 'returned')
                    .reduce((sum, prod) => sum + (prod.totalPrice || 0), 0);

                let refundAmount = orderProduct.totalPrice;

                // If there's a coupon applied and the remaining total doesn't meet the minimum required amount
                if (appliedCoupon && remainingTotal < appliedCoupon.minimumOrderValue) {
                    // Adjust the refund by removing the coupon discount
                    refundAmount -= appliedCoupon.couponAmount;
                }

                // Round the refund amount to 2 decimal places
                refundAmount = parseFloat(refundAmount.toFixed(2));

                // Refund amount to wallet or Razorpay
                if (order.paymentMethod === 'wallet' || order.paymentMethod === 'razorpay') {
                    await updateWallet(userId, refundAmount, 'credit', `Order Returned - Order id:${orderId.toString().slice(-6).toUpperCase()}`);
                }

                // If the coupon was applied and the remaining total is below the minimum amount, update the coupon's usage
                if (order.couponCode && remainingTotal < appliedCoupon.minimumOrderValue) {
                    await Coupon.findOneAndUpdate(
                        { couponCode: order.couponCode },
                        { $pull: { userUsed: userId } },
                    );
                }

                // Check if all products in the order are returned
                const allProductsReturned = order.products.every((prod) => prod.status === 'returned');

                // If all products are returned, update the order status
                if (allProductsReturned) {
                    await Order.findByIdAndUpdate(orderId, {
                        $set: { status: 'returned' },
                    });
                }

                res.json({ success: true });
            } else if (decision === 'denied') {
                // If the decision is 'denied', just update the return request status
                await Order.findByIdAndUpdate(
                    { _id: orderId, 'products.productId': productId },
                    {
                        $set: {
                            [`products.${index}.returnRequest`]: decision,
                        },
                    },
                );
                res.json({ success: true });
            } else {
                res.status(400).json({ success: false, message: 'Invalid decision' });
            }
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    };
}

export default new ReturnController();
