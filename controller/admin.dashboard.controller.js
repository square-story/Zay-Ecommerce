import User from '../models/user.model.js';
import Order from '../models/order.model.js';
import adminHelpers from '../helpers/best.selling.helper.js';

class AdminDashboardController {
    // load admin home page
    loadAdmin = async (req, res) => {
        try {
            const currentDate = new Date();
            const startDate = new Date(currentDate - 30 * 24 * 60 * 60 * 1000);
            // Fetch all users
            const users = await User.find();
            const userCount = users.length;

            // Fetch orders placed in the last 30 days
            const orders = await Order.find({
                date: { $gte: startDate, $lt: currentDate },
            });

            // Fetch all orders
            const allOrders = await Order.find();

            // Calculate various metrics
            const orderCount = orders.length;
            const monthlyEarning = orders.reduce(
                (acc, order) => (order.status === 'placed' ? acc + order.totalAmount : acc),
                0,
            );
            const revenue = allOrders.reduce((acc, order) => acc + order.totalAmount, 0);
            const productCount = orders.reduce((acc, order) => acc + order.products.length, 0);

            // Aggregate monthly ordered count
            const monthlyOrderedCount = await Order.aggregate([
                {
                    $match: {
                        status: 'placed',
                        date: { $gte: startDate, $lt: currentDate },
                    },
                },
                {
                    $group: {
                        _id: { $month: '$date' },
                        totalAmount: { $sum: '$totalAmount' },
                    },
                },
            ]);

            // Prepare monthly data array
            const monthlyData = Array.from({ length: 12 }).fill(0);
            monthlyOrderedCount.forEach((item) => {
                const monthIndex = item._id - 1;
                if (monthIndex >= 0 && monthIndex < 12) {
                    monthlyData[monthIndex] = item.totalAmount;
                }
            });

            // Fetch best selling name, category, and brand
            console.log('Fetching best selling data...');
            const bestSellingName = await adminHelpers.bestSelling('_id');
            console.log('Best selling name fetched');
            const bestSellingCategory = await adminHelpers.bestSelling('cetagory');
            console.log('Best selling category fetched:', bestSellingCategory ? bestSellingCategory.length : 0);
            const bestSellingBrand = await adminHelpers.bestSelling('brand');
            console.log('Best selling brand fetched');

            // Check if bestSellingCategory is valid before mapping
            const topTenCategories = await adminHelpers.mapCategory(bestSellingCategory);
            console.log('Top ten categories mapped');

            // Render admin dashboard with data
            console.log('Rendering admin dashboard...');
            res.render('adminDashboard', {
                monthlyData,
                userCount,
                monthlyEarning,
                revenue,
                orderCount,
                productCount,
                name: bestSellingName,
                brand: bestSellingBrand,
                topTenCategory: topTenCategories,
            });
        } catch (error) {
            console.log(error);
            console.log(req.session.admin);
            // Handle errors appropriately, maybe render an error page
            res.status(500).send('Internal Server Error');
        }
    };

    // filtering dashboard with functional graph 
    filterDashboard = async (req, res) => {
        try {
            const { data } = req.body;
            const desiredMonth = data; // Example for January 2024
            const startDate = new Date(desiredMonth + '-01T00:00:00Z'); // Start of month
            const endDate = new Date(desiredMonth + '-31T23:59:59Z'); // End of month (adjusted for days in February)
            console.log(startDate);
            const monthData = await Order.aggregate([
                {
                    $match: {
                        status: 'placed',
                        date: { $gte: startDate, $lt: endDate },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%d',
                                date: '$date',
                            },
                        },
                        totalAmount: { $sum: '$totalAmount' },
                    },
                },
            ]);
            console.log(monthData);

            // Initialize an array with 12 elements, each set to zero
            const newData = Array.from({ length: 30 }).fill(0);

            // Populate the array based on the provided data
            monthData.forEach((item) => {
                console.log(item);
                const monthIndex = parseInt(item._id, 10) - 1; // Convert _id to zero-based index
                if (monthIndex >= 0 && monthIndex < 30) {
                    newData[monthIndex] = item.totalAmount;
                }
            });

            console.log(newData);
            res.json({ newData, data });
        } catch (error) {
            console.log(error);
        }
    };
}

export default new AdminDashboardController();
