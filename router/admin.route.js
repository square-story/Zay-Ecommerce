import express, { Router } from 'express';
// import adminController from '../controller/admin.controller.js';
import adminDashboardController from '../controller/admin.dashboard.controller.js';
import adminUserController from '../controller/admin.user.controller.js';
import adminProductController from '../controller/admin.product.controller.js';
import adminOrderController from '../controller/admin.order.controller.js';
import productController from '../controller/product.controller.js';
import cetagoryContorller from '../controller/category.controller.js';
import couponController from '../controller/coupon.controller.js';
import offerController from '../controller/offer.controller.js';
import salesReportController from '../controller/sales.report.controller.js';
import exportController from '../controller/export.controller.js';
import nocache from 'nocache';
import { islogin, logged } from '../middleware/admin.auth.middleware.js';
import multer from '../middleware/multer.middleware.js';
import adminAuthController from '../controller/admin.auth.controller.js';
import returnController from '../controller/return.controller.js';

const adminRoute = Router();

adminRoute.use(nocache());

adminRoute.use((req, res, next) => {
  res.header('Cache-Control', 'no-store, private, must-revalidate');
  next();
});

adminRoute.use(express.json());
adminRoute.use(express.urlencoded({ extended: true }));


// load home page
adminRoute.get('/', islogin, adminDashboardController.loadAdmin);

adminRoute.post('/order-filter', adminDashboardController.filterDashboard);

// load user management

adminRoute.get('/user', islogin, adminUserController.loadUser);

// block user

adminRoute.post('/blockUser', adminUserController.blockUser);

// load product

adminRoute.get('/product', islogin, adminProductController.loadPoduct);

// load add Product

adminRoute.get('/addProduct', islogin, adminProductController.loadAddProduct);

// load cetagory

adminRoute.get('/cetagory', islogin, cetagoryContorller.loadCategory);

// load add cetagory

adminRoute.post('/addCetagory', cetagoryContorller.AddCetogory);

// cetagory list / Unlist

adminRoute.post('/listCetagory', cetagoryContorller.listCetagory);

// edit cetagory

adminRoute.post('/editCetagory', cetagoryContorller.editCetagory);

//offer offers
adminRoute.get('/offer-management', islogin, offerController.loadAdminOfferPage);

//create Offer
adminRoute.post('/create-offer', islogin, offerController.createOfferPost);

//edit Offer
adminRoute.put('/edit-offer', islogin, offerController.editOfferPost);

adminRoute.post('/check-offer-name', offerController.checkOfferName);

//delete Offer
adminRoute.delete('/delete-offer', islogin, offerController.deleteOffer);

// add-product
adminRoute.post('/add-product', multer.array('images'), productController.addproduct);

// list / unlist product
adminRoute.post('/listProduct', productController.listProduct);

// load variant
adminRoute.get('/loadVariant/:id', islogin, productController.loadVariant);

// add variant

adminRoute.post('/addVariant', multer.array('images'), productController.addVariant);

// load edit variant

adminRoute.get('/edit-variant', islogin, productController.LoadeditVariant);

// edit variant

adminRoute.post(
  '/editVariant',
  multer.fields([
    { name: 'image0', maxCount: 1 },
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
    { name: 'image3', maxCount: 1 },
  ]),
  productController.editVariant,
);

// load admin login
adminRoute.get('/login', logged, adminAuthController.loadLogin);

// login
adminRoute.post('/login', adminAuthController.login);

adminRoute.post('/logout', adminAuthController.logout);

// order

adminRoute.get('/order', islogin, adminOrderController.loadOrder);

adminRoute.get('/single-orderDetails', islogin, adminOrderController.loadsingleOrder);

// adminRoute.get('/Cancelationdetails', islogin, adminController.loadSingleCancelation);

adminRoute.post('/change-orderStatus', adminOrderController.changeOrderStatus);

// adminRoute.get('/cancel-request', islogin, adminController.loadCancel);

// adminRoute.post('/cancel-request', adminController.controlCancelation);

adminRoute.get('/returns', islogin, returnController.loadReturns);

adminRoute.post('/returns', returnController.returns);

// coupon management

adminRoute.get('/load-coupon', islogin, couponController.loadCoupon);

adminRoute.post('/create-coupon', couponController.createCoupon);

adminRoute.put('/edit-coupon', couponController.editCoupon);

adminRoute.post('/check-coupon-name', couponController.checkCouponName);

adminRoute.delete('/deleteCoupon', couponController.deleteCoupon);

adminRoute.post('/order-filter', adminDashboardController.filterDashboard);

adminRoute.get('/sales-report', islogin, salesReportController.loadSalesReport);

adminRoute.get('/download-sales-report', islogin, exportController.downloadSalesReport);

adminRoute.get('/download-sales-report-excel', islogin, exportController.downloadExcel);

export default adminRoute;

