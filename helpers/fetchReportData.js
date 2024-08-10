// Assuming you have a function to fetch report data based on date range
const Order = require('../models/order'); // Adjust path as needed

async function fetchReportData(startDate, endDate) {
  try {
    let query = {};
    const currentDate = new Date();

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      query = { date: { $gte: start, $lte: end } };
    } else {
      const end = currentDate;
      const start = new Date();
      start.setMonth(currentDate.getMonth() - 1);
      query = { date: { $gte: start, $lte: end } };
    }

    const report = await Order.find(query).populate('user').sort({ date: -1 });
    return report;
  } catch (error) {
    throw new Error('Error fetching report data');
  }
}

module.exports = { fetchReportData }; // Export the function
