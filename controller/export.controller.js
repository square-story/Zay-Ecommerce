import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import moment from 'moment';
import salesReportController from './sales.report.controller.js';

class ExportController {
    downloadSalesReport = async (req, res) => {
        try {
            const { startDate, endDate } = salesReportController.getDateRange(req.query);

            // Fetch orders using the same consistency
            const orders = await salesReportController.fetchOrders(startDate, endDate);

            // Calculate totals
            const { totalSales, totalDiscounts, revenue, totalItems } = salesReportController.calculateTotals(orders);

            // Create PDF
            const doc = this.createPDFDocument(res);

            // Generate report content
            this.generateReportContent(
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

    createPDFDocument(res) {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
        doc.pipe(res);
        return doc;
    }

    generateReportContent(
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
        let tableTop = 150;
        const columnWidths = [40, 100, 100, 80, 80, 100]; // Adjusted widths
        const columnPositions = [50, 90, 190, 290, 370, 470]; // Adjusted positions

        // Header
        this.drawHeader(doc, startDate, endDate);

        // Table headers
        this.drawTableHeaders(doc, tableTop, columnPositions, columnWidths);

        // Table rows
        this.drawTableRows(doc, orders, tableTop, columnPositions, columnWidths, pageNumber);

        // Summary
        this.drawSummary(doc, totalSales, totalDiscounts, revenue, totalItems);
    }

    drawHeader(doc, startDate, endDate) {
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

    drawTableHeaders(doc, tableTop, columnPositions, columnWidths) {
        doc.fontSize(10).font('Helvetica-Bold');
        const headers = ['Index', 'User', 'Payment Method', 'Items', 'Amount', 'Date'];
        headers.forEach((header, i) => {
            doc.text(header, columnPositions[i], tableTop, {
                width: columnWidths[i],
                align: i === 4 ? 'right' : 'left',
            });
        });
        this.drawLine(doc, tableTop + 15);
    }

    drawTableRows(doc, orders, tableTop, columnPositions, columnWidths, pageNumber) {
        doc.font('Helvetica').fontSize(9);
        orders.forEach((order, index) => {
            const position = tableTop + 30 + (index % 25) * 20;
            if ((index + 1) % 25 === 0 && index !== orders.length - 1) {
                this.drawFooter(doc, pageNumber);
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
        this.drawLine(doc, doc.y + 15);
    }

    drawSummary(doc, totalSales, totalDiscounts, revenue, totalItems) {
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

    drawLine(doc, y) {
        doc.lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
    }

    drawFooter(doc, pageNumber) {
        const footerTop = 750;
        doc
            .fontSize(10)
            .font('Helvetica-Oblique')
            .text('Zay E-Commerce Website', 50, footerTop, { align: 'left' })
            .text(`Page ${pageNumber}`, 550, footerTop, { align: 'right' });
    }

    downloadExcel = async (req, res) => {
        try {
            const { startDate, endDate } = salesReportController.getDateRange(req.query);

            // Consistency: reuse the shared query logic
            const orders = await salesReportController.fetchOrders(startDate, endDate);

            // Calculate total sales and total discounts
            const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
            const totalDiscounts = orders.reduce((sum, order) => sum + order.discountedAmount, 0);

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
                    user: order.user ? order.user.name : 'Unknown',
                    paymentMethod: order.paymentMethod,
                    status: order.paymentStatus || order.status,
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
}

export default new ExportController();
