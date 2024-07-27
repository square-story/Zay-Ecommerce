const PDFDocument = require("pdfkit");
const Order = require("../models/order"); // Your Order model

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
      throw new Error("Invalid date format");
    }

    query = { date: { $gte: startDate, $lte: endDate } };

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / itemsPerPage);

    const report = await Order.find(query)
      .populate("user")
      .sort({ date: -1 })
      .skip((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage);

    res.render("salesreport", {
      report,
      currentPage,
      totalPages,
      itemsPerPage,
      startDate: req.query.startDate || startDate.toISOString().split("T")[0],
      endDate: req.query.endDate || endDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports.downloadSalesReport = async (req, res) => {
  try {
    let query = {};
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
      throw new Error("Invalid date format");
    }

    query = { date: { $gte: startDate, $lte: endDate } };

    const report = await Order.find(query).populate("user").sort({ date: -1 });

    const doc = new PDFDocument({ margin: 30, size: "A4" });
    doc.pipe(res);

    // Initialize page number
    let pageNumber = 1;

    // Function to draw the footer
    const drawFooter = (doc, pageNumber) => {
      const footerTop = 750;
      doc
        .fontSize(10)
        .font("Helvetica-Oblique")
        .text("Zay E-Commerce Website", 50, footerTop, { align: "left" })
        .text(`${pageNumber}`, 550, footerTop, { align: "right" });
    };

    // Header
    doc
      .fontSize(25)
      .font("Helvetica-Bold")
      .text("Sales Report", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`From: ${startDate.toDateString()} To: ${endDate.toDateString()}`, {
        align: "center",
      });
    doc.moveDown(1);

    // Table headers
    const tableTop = 150;
    const columnWidths = [50, 100, 100, 100, 100, 100];

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Index", 50, tableTop, { width: columnWidths[0], align: "left" });
    doc.text("User", 100, tableTop, { width: columnWidths[1], align: "left" });
    doc.text("Payment Method", 200, tableTop, {
      width: columnWidths[2],
      align: "left",
    });
    doc.text("Payment Status", 300, tableTop, {
      width: columnWidths[3],
      align: "left",
    });
    doc.text("Total Amount", 400, tableTop, {
      width: columnWidths[4],
      align: "left",
    });
    doc.text("Date", 500, tableTop, { width: columnWidths[5], align: "left" });

    const drawLine = (doc, y) => {
      doc.lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
    };

    drawLine(doc, tableTop + 15);

    // Table rows
    let position;
    doc.font("Helvetica").fontSize(10);
    report.forEach((el, index) => {
      position = tableTop + 30 + (index % 25) * 20;
      doc.text(index + 1, 50, position, {
        width: columnWidths[0],
        align: "left",
      });
      doc.text(el.user.name, 100, position, {
        width: columnWidths[1],
        align: "left",
      });
      doc.text(el.paymentMethod, 200, position, {
        width: columnWidths[2],
        align: "left",
      });
      doc.text(el.status, 300, position, {
        width: columnWidths[3],
        align: "left",
      });
      doc.text(el.totalAmount, 400, position, {
        width: columnWidths[4],
        align: "left",
      });
      doc.text(
        new Date(el.date).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        500,
        position,
        { width: columnWidths[5], align: "left" }
      );

      if ((index + 1) % 25 === 0 && index !== report.length - 1) {
        drawFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
      }
    });

    drawLine(doc, position + 15);

    drawFooter(doc, pageNumber);

    doc.end();
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports.downloadInvoice = async (req, res) => {
  try {
    const { orderId, index } = req.query;
    const order = await Order.findOne({ _id: orderId })
      .populate("user")
      .populate("products.productId");

    const doc = new PDFDocument();

    // Set response to application/pdf
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=invoice.pdf");

    // Pipe the document to the response
    doc.pipe(res);

    // Add content to the PDF
    doc.fontSize(25).text("Invoice", { align: "center" });

    doc.fontSize(18).text("Bill To:", { underline: true });
    doc.text(
      `Zay Fashion\nCalicut, Kerala, 673001\nEmail: Zay e-commerce\nPhone: +91-90488-34867\nGSTIN: 29ABCDE1234F2Z5`
    );

    doc.moveDown();
    doc.fontSize(18).text("Ship To:", { underline: true });
    doc.text(
      `${order.user.name}\n${order.deliveryDetails.address}\n${order.deliveryDetails.city}, ${order.deliveryDetails.state} ${order.deliveryDetails.pincode}, ${order.deliveryDetails.country}\nPhone: ${order.deliveryDetails.phone}\nEmail: ${order.deliveryDetails.email}`
    );

    doc.moveDown();
    doc.fontSize(18).text("Invoice Details:", { underline: true });
    doc.text(`Invoice Number: ${order._id}`);
    const invoiceDate = new Date(order.date);
    const formattedDate = invoiceDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Invoice Date: ${formattedDate}`);

    doc.moveDown();
    doc.fontSize(18).text("Products:");
    doc.fontSize(14);
    const product = order.products[index];
    if (product) {
      const preTaxPrice = product.price / 1.18; // Remove 18% tax
      const taxAmount = (product.price - preTaxPrice) * product.quantity;
      const totalAmount = product.price * product.quantity;
      doc.text(
        `Name: ${product.productId.name}\nQuantity: ${
          product.quantity
        }\nUnit Price (excluding tax): ${preTaxPrice.toFixed(
          2
        )}\nTAX (18%): ${taxAmount.toFixed(
          2
        )}\nTotal (including tax): ${totalAmount.toFixed(2)}`
      );
    }

    doc.moveDown();
    doc
      .fontSize(18)
      .text(`Total Amount (including tax): ${order.totalAmount.toFixed(2)}`);

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while generating the invoice");
  }
};
