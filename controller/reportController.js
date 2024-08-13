const PDFDocument = require('pdfkit');
const Order = require('../models/order'); // Your Order model
const ExcelJS = require('exceljs');
const moment = require('moment');
const { fetchReportData } = require('../helpers/fetchReportData');

module.exports.loadSalesReport = async (req, res) => {
  try {
    let query = {};
    let currentPage = req.query.page ? parseInt(req.query.page) : 1;
    const itemsPerPage = 20;

    const currentDate = new Date();
    let startDate, endDate;

    if (req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);
    } else {
      endDate = currentDate;
      startDate = new Date();
      startDate.setMonth(currentDate.getMonth() - 1);
    }

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format');
    }

    query = {
      date: { $gte: startDate, $lte: endDate },
      paymentStatus: 'completed', // Filter for completed payments only
      status: { $nin: ['returned', 'canceled', 'failed'] }, // Exclude returned or canceled orders
    };

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
      startDate: req.query.startDate || startDate.toISOString().split('T')[0],
      endDate: req.query.endDate || endDate.toISOString().split('T')[0],
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
};

module.exports.downloadSalesReport = async (req, res) => {
  try {
    // Date range setup
    const { startDate, endDate } = getDateRange(req.query);

    // Fetch orders
    const orders = await fetchOrders(startDate, endDate);

    // Calculate totals
    const { totalSales, totalDiscounts, revenue, totalItems } = calculateTotals(orders);

    // Create PDF
    const doc = createPDFDocument(res);

    // Generate report content
    generateReportContent(
      doc,
      orders,
      startDate,
      endDate,
      totalSales,
      totalDiscounts,
      revenue,
      totalItems,
    );

    // Finalize the PDF
    doc.end();
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).send('Internal Server Error');
  }
};

function getDateRange(query) {
  const currentDate = new Date();
  let startDate, endDate;

  if (query.startDate && query.endDate) {
    startDate = new Date(query.startDate);
    endDate = new Date(query.endDate);
  } else {
    endDate = currentDate;
    startDate = new Date(currentDate);
    startDate.setMonth(currentDate.getMonth() - 1);
  }

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format');
  }

  return { startDate, endDate };
}

async function fetchOrders(startDate, endDate) {
  const query = { date: { $gte: startDate, $lte: endDate } };
  return await Order.find(query).populate('user', 'name').sort({ date: -1 });
}

function calculateTotals(orders) {
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

function createPDFDocument(res) {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
  doc.pipe(res);
  return doc;
}

function generateReportContent(
  doc,
  orders,
  startDate,
  endDate,
  totalSales,
  totalDiscounts,
  revenue,
  totalItems,
) {
  let pageNumber = 1;
  const tableTop = 150;
  const columnWidths = [40, 100, 100, 80, 80, 100]; // Adjusted widths
  const columnPositions = [50, 90, 190, 290, 370, 470]; // Adjusted positions

  // Header
  drawHeader(doc, startDate, endDate);

  // Table headers
  drawTableHeaders(doc, tableTop, columnPositions, columnWidths);

  // Table rows
  drawTableRows(doc, orders, tableTop, columnPositions, columnWidths, pageNumber);

  // Summary
  drawSummary(doc, totalSales, totalDiscounts, revenue, totalItems);
}

function drawHeader(doc, startDate, endDate) {
  doc.fontSize(25).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
  doc.moveDown(0.5);
  doc
    .fontSize(12)
    .font('Helvetica')
    .text(
      `From: ${moment(startDate).format('MMM D, YYYY')} To: ${moment(endDate).format('MMM D, YYYY')}`,
      { align: 'center' },
    );
  doc.moveDown(1);
}

function drawTableHeaders(doc, tableTop, columnPositions, columnWidths) {
  doc.fontSize(10).font('Helvetica-Bold');
  const headers = ['Index', 'User', 'Payment Method', 'Items', 'Amount', 'Date'];
  headers.forEach((header, i) => {
    doc.text(header, columnPositions[i], tableTop, {
      width: columnWidths[i],
      align: i === 4 ? 'right' : 'left',
    });
  });
  drawLine(doc, tableTop + 15);
}

function drawTableRows(doc, orders, tableTop, columnPositions, columnWidths, pageNumber) {
  doc.font('Helvetica').fontSize(9);
  orders.forEach((order, index) => {
    const position = tableTop + 30 + (index % 25) * 20;
    if ((index + 1) % 25 === 0 && index !== orders.length - 1) {
      drawFooter(doc, pageNumber);
      doc.addPage();
      pageNumber++;
      tableTop = 50;
    }

    const itemCount = Array.isArray(order.products)
      ? order.products.reduce((sum, product) => sum + (product.quantity || 0), 0)
      : 'N/A';

    const rowData = [
      (index + 1).toString(),
      order.user ? order.user.name : 'N/A',
      order.paymentMethod || 'N/A',
      itemCount.toString(),
      `Rs ${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}`,
      order.date ? moment(order.date).format('DD/MM/YYYY') : 'N/A',
    ];

    rowData.forEach((data, i) => {
      doc.text(data, columnPositions[i], position, {
        width: columnWidths[i],
        align: i === 4 ? 'right' : 'left',
      });
    });
  });
  drawLine(doc, doc.y + 15);
}

function drawSummary(doc, totalSales, totalDiscounts, revenue, totalItems) {
  doc.moveDown(2);
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text(`Total Items Sold: ${totalItems}`, 50, doc.y, { width: 250, align: 'left' });
  doc.moveDown(0.5);
  doc.text(`Total Sales: Rs ${totalSales.toFixed(2)}`, 50, doc.y, { width: 250, align: 'left' });
  doc.moveDown(0.5);
  doc.text(`Total Discounts: Rs ${totalDiscounts.toFixed(2)}`, 50, doc.y, {
    width: 250,
    align: 'left',
  });
  doc.moveDown(0.5);
  doc.text(`Net Revenue: Rs ${revenue.toFixed(2)}`, 50, doc.y, { width: 250, align: 'left' });
}

function drawLine(doc, y) {
  doc.lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

function drawFooter(doc, pageNumber) {
  const footerTop = 750;
  doc
    .fontSize(10)
    .font('Helvetica-Oblique')
    .text('Zay E-Commerce Website', 50, footerTop, { align: 'left' })
    .text(`Page ${pageNumber}`, 550, footerTop, { align: 'right' });
}

module.exports.downloadInvoice = async (req, res) => {
  try {
    const { orderId, index } = req.query;
    const order = await Order.findOne({ _id: orderId })
      .populate('user')
      .populate('products.productId');

    const doc = new PDFDocument();

    // Set response to application/pdf
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');

    // Pipe the document to the response
    doc.pipe(res);

    // Add content to the PDF
    doc.fontSize(25).text('Invoice', { align: 'center' });

    doc.fontSize(18).text('Bill To:', { underline: true });
    doc.text(
      `Zay Fashion\nCalicut, Kerala, 673001\nEmail: Zay e-commerce\nPhone: +91-90488-34867\nGSTIN: 29ABCDE1234F2Z5`,
    );

    doc.moveDown();
    doc.fontSize(18).text('Ship To:', { underline: true });
    doc.text(
      `${order.user.name}\n${order.deliveryDetails.address}\n${order.deliveryDetails.city}, ${order.deliveryDetails.state} ${order.deliveryDetails.pincode}, ${order.deliveryDetails.country}\nPhone: ${order.deliveryDetails.phone}\nEmail: ${order.deliveryDetails.email}`,
    );

    doc.moveDown();
    doc.fontSize(18).text('Invoice Details:', { underline: true });
    doc.text(`Invoice Number: ${order._id}`);
    const invoiceDate = new Date(order.date);
    const formattedDate = invoiceDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(`Invoice Date: ${formattedDate}`);

    doc.moveDown();
    doc.fontSize(18).text('Products:');
    doc.fontSize(14);
    const product = order.products[index];
    if (product) {
      const preTaxPrice = product.price / 1.18; // Remove 18% tax
      const taxAmount = (product.price - preTaxPrice) * product.quantity;
      const totalAmount = product.price * product.quantity;
      doc.text(
        `Name: ${product.productId.name}\nQuantity: ${
          product.quantity
        }\nUnit Price (excluding tax): ${preTaxPrice.toFixed(2)}\nTAX (18%): ${taxAmount.toFixed(
          2,
        )}\nTotal (including tax): ${totalAmount.toFixed(2)}`,
      );
    }

    doc.moveDown();
    doc.fontSize(18).text(`Total Amount (including tax): ${order.totalAmount.toFixed(2)}`);

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while generating the invoice');
  }
};

module.exports.downloadExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Parse and validate dates
    const start = moment(startDate, 'YYYY-MM-DD', true);
    const end = moment(endDate, 'YYYY-MM-DD', true);

    if (!start.isValid() || !end.isValid()) {
      throw new Error('Invalid date format');
    }

    const query = {
      date: { $gte: start.toDate(), $lte: end.toDate() },
    };
    const orders = await Order.find(query).populate('user').sort({ date: -1 });

    // Calculate total sales and total discounts
    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalDiscounts = orders.reduce((sum, order) => sum + order.discountedAmount, 0);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add headers
    worksheet.columns = [
      { header: 'Index', key: 'index', width: 10 },
      { header: 'User', key: 'user', width: 20 },
      { header: 'Payment Method', key: 'paymentMethod', width: 20 },
      { header: 'Payment Status', key: 'status', width: 15 },
      { header: 'Total Amount', key: 'totalAmount', width: 15 },
      { header: 'Date', key: 'date', width: 15 },
    ];

    // Add data to worksheet
    orders.forEach((order, i) => {
      worksheet.addRow({
        index: i + 1,
        user: order.user.name,
        paymentMethod: order.paymentMethod,
        status: order.status,
        totalAmount: order.totalAmount.toFixed(2),
        date: moment(order.date).format('MMM D, YYYY'),
      });
    });

    // Add total amount and discount rows
    worksheet.addRow({});
    worksheet.addRow({
      index: '',
      user: '',
      paymentMethod: '',
      status: 'Total Sales',
      totalAmount: totalSales.toFixed(2),
    });
    worksheet.addRow({
      index: '',
      user: '',
      paymentMethod: '',
      status: 'Total Discounts',
      totalAmount: totalDiscounts.toFixed(2),
    });

    // Write Excel file to response
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel file:', error.message);
    console.error(error.stack);
    res.status(500).send('Error generating Excel file');
  }
};
