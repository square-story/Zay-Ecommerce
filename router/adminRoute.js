import express, { Router } from 'express';
import adminController from '../controller/adminController.js';
import productController from '../controller/product.js';
import cetagoryContorller from '../controller/cetagoryController.js';
import couponController from '../controller/couponController.js';
import offerController from '../controller/offerController.js';
import reportController from '../controller/reportController.js';
import nocache from 'nocache';
import { islogin, logged } from '../middleware/adminAuth.js';
import multer from '../middleware/multer.js';

const adminRoute = Router();

adminRoute.use(nocache());

adminRoute.use((req, res, next) => {
  res.header('Cache-Control', 'no-store, private, must-revalidate');
  next();
});

adminRoute.use(express.json());
adminRoute.use(express.urlencoded({ extended: true }));


// load home page
adminRoute.get('/', islogin, adminController.loadAdmin);

adminRoute.post('/order-filter', adminController.filterDashboard);

// load user management

adminRoute.get('/user', islogin, adminController.loadUser);

// block user

adminRoute.post('/blockUser', adminController.blockUser);

// load product

adminRoute.get('/product', islogin, adminController.loadPoduct);

// load add Product

adminRoute.get('/addProduct', islogin, adminController.loadAddProduct);

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
adminRoute.get('/login', logged, adminController.loadLogin);

// login
adminRoute.post('/login', adminController.login);

adminRoute.post('/logout', adminController.logout);

// order

adminRoute.get('/order', islogin, adminController.loadOrder);

adminRoute.get('/single-orderDetails', islogin, adminController.loadsingleOrder);

// adminRoute.get('/Cancelationdetails', islogin, adminController.loadSingleCancelation);

adminRoute.post('/change-orderStatus', adminController.changeOrderStatus);

// adminRoute.get('/cancel-request', islogin, adminController.loadCancel);

// adminRoute.post('/cancel-request', adminController.controlCancelation);

adminRoute.get('/returns', islogin, adminController.loadReturns);

adminRoute.post('/returns', adminController.returns);

// coupon management

adminRoute.get('/load-coupon', islogin, couponController.loadCoupon);

adminRoute.post('/create-coupon', couponController.createCoupon);

adminRoute.put('/edit-coupon', couponController.editCoupon);

adminRoute.post('/check-coupon-name', couponController.checkCouponName);

adminRoute.delete('/deleteCoupon', couponController.deleteCoupon);

adminRoute.post('/order-filter', adminController.filterDashboard);

adminRoute.get('/sales-report', islogin, reportController.loadSalesReport);

adminRoute.get('/download-sales-report', islogin, reportController.downloadSalesReport);

adminRoute.get('/download-sales-report-excel', islogin, reportController.downloadExcel);

export default adminRoute;

