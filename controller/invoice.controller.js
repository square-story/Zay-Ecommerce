import Order from '../models/order.model.js';

import PDFDocument from 'pdfkit';

class InvoiceController {
    loadInvoice = async (req, res) => {
        try {
            const { orderId, index } = req.query;
            const order = await Order.findOne({ _id: orderId })
                .populate('user')
                .populate('products.productId');

            if (!order || !order.products || order.products.length === 0) {
                return res.status(404).send('Order not found or no products in order');
            }

            // Filter out products with status 'returned' or 'canceled'
            const filteredProducts = order.products.filter(
                (product) => product.status !== 'returned' && product.status !== 'canceled',
            );
            console.log(filteredProducts);

            // Calculate the total amount by excluding returned products
            const totalAmount = filteredProducts.reduce((acc, product) => {
                return acc + product.price * product.quantity;
            }, 0);

            console.log(totalAmount);

            res.render('invoice', {
                order: { ...order.toObject(), products: filteredProducts, totalAmount }, // Pass filtered products
                deliveryAddress: order.deliveryDetails,
                index: index || 0, // Ensure `index` is passed here
            });
        } catch (error) {
            console.log(error);
            res.status(500).send('An error occurred while loading the invoice');
        }
    };

    downloadInvoice = async (req, res) => {
        try {
            const { orderId } = req.query;
            const order = await Order.findOne({ _id: orderId })
                .populate('user')
                .populate('products.productId');

            if (!order || !order.products || order.products.length === 0) {
                return res.status(404).send('Order not found or no products in order');
            }

            const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 10 });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');

            // Pipe the PDF into the response
            doc.pipe(res);

            // Add content to the PDF
            doc.fontSize(25).text('GST Invoice', { align: 'center' });

            // Bill To
            doc.fontSize(10).text('Bill To:', { underline: true });
            doc.text(
                `Zay Fashion\nCalicut, Kerala, 673001\nEmail: Zay e-commerce\nPhone: +91-90488-34867\nGSTIN: 29ABCDE1234F2Z5`,
            );

            // Ship To
            doc.moveDown();
            doc.fontSize(10).text('Ship To:', { underline: true });
            doc.text(
                `${order.user.name}\n${order.deliveryDetails.address}\n${order.deliveryDetails.city}, ${order.deliveryDetails.state} ${order.deliveryDetails.pincode}, ${order.deliveryDetails.country}\nPhone: ${order.deliveryDetails.phone}\nEmail: ${order.deliveryDetails.email}`,
            );

            // Invoice Details
            doc.moveDown();
            doc.fontSize(10).text('Invoice Details:', { underline: true });
            doc.text(`Invoice Number: ${order._id}`);
            const invoiceDate = new Date(order.date);
            const formattedDate = invoiceDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            doc.text(`Invoice Date: ${formattedDate}`);

            // Table Header
            doc.moveDown();
            doc.fontSize(18).text('Products:', { underline: true });
            doc.fontSize(14);

            const tableTop = doc.y;
            const rowHeight = 30;
            const columnWidths = [300, 100, 200, 100, 200]; // Adjust column widths for landscape
            const tableWidth = columnWidths.reduce((a, b) => a + b, 0);

            // Draw table header
            doc.rect(doc.page.margins.left, tableTop, tableWidth, rowHeight).stroke();
            doc.text('Name', doc.page.margins.left + 5, tableTop + 5);
            doc.text('Quantity', doc.page.margins.left + columnWidths[0] + 5, tableTop + 5);
            doc.text(
                'Unit Price (excl. tax)',
                doc.page.margins.left + columnWidths[0] + columnWidths[1] + 5,
                tableTop + 5,
            );
            doc.text(
                'TAX (18%)',
                doc.page.margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2] + 5,
                tableTop + 5,
            );
            doc.text(
                'Total (incl. tax)',
                doc.page.margins.left +
                columnWidths[0] +
                columnWidths[1] +
                columnWidths[2] +
                columnWidths[3] +
                5,
                tableTop + 5,
            );

            doc.moveDown();
            let currentY = tableTop + rowHeight;

            let subTotal = 0; // Accumulate subtotal
            let totalTax = 0; // Accumulate total tax

            // Draw table rows
            order.products.forEach((product) => {
                if (product.status !== 'returned' && product.status !== 'canceled') {
                    const unitPrice = product.price / 1.18; // Remove 18% tax
                    const taxAmount = (product.price - unitPrice) * product.quantity;
                    const totalAmount = product.price * product.quantity;

                    subTotal += unitPrice * product.quantity;
                    totalTax += taxAmount;

                    doc.rect(doc.page.margins.left, currentY, tableWidth, rowHeight).stroke();
                    doc.text(product.productId.name, doc.page.margins.left + 5, currentY + 5);
                    doc.text(product.quantity, doc.page.margins.left + columnWidths[0] + 5, currentY + 5);
                    doc.text(
                        `${unitPrice.toFixed(2)}`,
                        doc.page.margins.left + columnWidths[0] + columnWidths[1] + 5,
                        currentY + 5,
                    );
                    doc.text(
                        `${taxAmount.toFixed(2)}`,
                        doc.page.margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2] + 5,
                        currentY + 5,
                    );
                    doc.text(
                        `${totalAmount.toFixed(2)}`,
                        doc.page.margins.left +
                        columnWidths[0] +
                        columnWidths[1] +
                        columnWidths[2] +
                        columnWidths[3] +
                        5,
                        currentY + 5,
                    );

                    currentY += rowHeight;
                }
            });

            // Draw table footer
            doc.moveDown();
            doc.y = currentY + 10;

            // Final amounts
            const totalAmountText = `Subtotal (excluding tax): ${subTotal.toFixed(2)}\nTotal Tax: ${totalTax.toFixed(2)}\nTotal Amount (including tax): ${(subTotal + totalTax).toFixed(2)}`;

            doc.fontSize(18).text(totalAmountText, doc.page.margins.left, doc.y);

            // Finalize the PDF
            doc.end();
        } catch (error) {
            console.error(error);
            res.status(500).send('An error occurred while generating the invoice');
        }
    };
}

export default new InvoiceController();
