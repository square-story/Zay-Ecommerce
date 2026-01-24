import Order from '../models/order.model.js';
import product from '../models/product.model.js';

class AdminOrderController {
    loadOrder = async (req, res) => {
        try {
            const page = req.query.page || 0;
            const totalOrders = await Order.countDocuments();
            const order = await Order.find()
                .populate('user')
                .populate('products.productId')
                .sort({ date: -1 })
                .skip(page * 8)
                .limit(8);

            console.log(order);
            res.render('order-details', {
                order: order,
                page: parseInt(page),
                orderLength: Math.ceil(totalOrders / 8),
            });
        } catch (error) {
            console.log(error);
        }
    };

    loadsingleOrder = async (req, res) => {
        try {
            console.log(req.query);
            const { orderId, returns } = req.query;
            const orderDetails = await Order.findById({ _id: orderId })
                .populate('user')
                .populate('products.productId');
            console.log(orderDetails);
            if (returns) {
                return res.render('returnSingleProduct', { order: orderDetails });
            }
            res.render('singleOrderDetials', { order: orderDetails });
        } catch (error) {
            console.log(error);
        }
    };

    changeOrderStatus = async (req, res) => {
        try {
            const { orderId, productId, index, status, userId } = req.body;

            console.log(req.body);

            const order = await Order.findOneAndUpdate(
                { _id: orderId, user: userId, 'products.productId': productId },
                {
                    $set: {
                        [`products.${index}.status`]: status,
                    },
                },
                {
                    new: true,
                },
            );

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            if (status === 'canceled') {
                // Increment product stock
                const quantity = order.products[index].quantity;
                await product.findOneAndUpdate(
                    { _id: productId },
                    {
                        $inc: {
                            [`variant.${index}.stock`]: quantity,
                        },
                    },
                );
            }

            res.json({ success: true, status: status });
        } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    };
}

export default new AdminOrderController();
