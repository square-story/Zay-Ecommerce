import Order from '../models/order.model.js';
import moment from 'moment';

class SalesReportController {
    // Shared query filter for completed/valid orders
    getBaseQuery(startDate, endDate) {
        return {
            date: { $gte: startDate, $lte: endDate },
            paymentStatus: 'completed',
            status: { $nin: ['returned', 'canceled', 'failed'] },
        };
    }

    loadSalesReport = async (req, res) => {
        try {
            let currentPage = req.query.page ? parseInt(req.query.page) : 1;
            const itemsPerPage = 20;

            const { startDate, endDate } = this.getDateRange(req.query);
            const query = this.getBaseQuery(startDate, endDate);

            const totalOrders = await Order.countDocuments(query);
            const totalPages = Math.ceil(totalOrders / itemsPerPage);

            const report = await Order.find(query)
                .populate('user')
                .sort({ date: -1 })
                .skip((currentPage - 1) * itemsPerPage)
                .limit(itemsPerPage);

            res.render('salesreport', {
                report,
                currentPage,
                totalPages,
                itemsPerPage,
                // Pass back YYYY-MM-DD strings for the date inputs
                startDate: moment(startDate).format('YYYY-MM-DD'),
                endDate: moment(endDate).format('YYYY-MM-DD'),
            });
        } catch (error) {
            console.log(error);
            res.status(500).send('Internal Server Error');
        }
    };

    getDateRange(query) {
        const currentDate = new Date();
        let startDate, endDate;

        if (query.startDate && query.endDate) {
            // Parse input (YYYY-MM-DD) and set time boundaries
            startDate = new Date(query.startDate);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(query.endDate);
            endDate.setHours(23, 59, 59, 999);
        } else {
            // Default to last 30 days
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);

            startDate = new Date();
            startDate.setMonth(currentDate.getMonth() - 1);
            startDate.setHours(0, 0, 0, 0);
        }

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Invalid date format');
        }

        return { startDate, endDate };
    }

    async fetchOrders(startDate, endDate) {
        // Use the shared base query
        const query = this.getBaseQuery(startDate, endDate);
        return await Order.find(query).populate('user', 'name').sort({ date: -1 });
    }

    calculateTotals(orders) {
        let totalSales = 0;
        let totalDiscounts = 0;
        let totalItems = 0;

        orders.forEach((order) => {
            totalSales += order.totalAmount || 0;
            totalDiscounts += order.discountedAmount || 0;

            if (Array.isArray(order.products)) {
                totalItems += order.products.reduce((sum, product) => sum + (product.quantity || 0), 0);
            }
        });

        const revenue = totalSales - totalDiscounts;

        return { totalSales, totalDiscounts, revenue, totalItems };
    }
}

export default new SalesReportController();
