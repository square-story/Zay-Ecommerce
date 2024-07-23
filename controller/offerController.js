const Offer = require('../models/offerModel')
const Product = require("../models/product")
const Category = require('../models/cetagory')

module.exports.loadAdminOfferPage = async(req,res)=>{
    try {
        const offers = await Offer.find({});
        const products = await Product.find({});
        const categories = await Category.find({});
        res.render("offerOperationPage",{offers,products,categories})
    } catch (error) {
        res.status(500).send('Failed to retrieve offers');
        console.log(error)
    }
}


module.exports.createOfferPost = async (req, res) => {
    const { name, adate, edate, limit, damount, type, productId, categoryId } = req.body;
    const newOffer = new Offer({ name, adate, edate, limit, damount, type, productId, categoryId });
    try {
        await newOffer.save();
        await applyOfferToProducts(newOffer); // Apply the offer to products
        res.redirect('/admin/offer-management');
    } catch (error) {
        console.log(error);
        res.status(500).send('Failed to create offer');
    }
};



module.exports.editOfferPost = async (req, res) => {
    const { id, name, adate, edate, limit, damount, type, productId, categoryId } = req.body;
    try {
        const offer = await Offer.findById(id);
        if (offer) {
            await removeOfferFromProducts(offer); // Remove the old offer
            Object.assign(offer, { name, adate, edate, limit, damount, type, productId, categoryId });
            await offer.save();
            await applyOfferToProducts(offer); // Apply the new offer
        }
        res.redirect('/admin/offer-management');
    } catch (error) {
        console.log(error);
        res.status(500).send('Failed to edit offer');
    }
};


module.exports.deleteOffer = async (req, res) => {
    try {
        const { id } = req.body;
        const offer = await Offer.findById(id);
        if (offer) {
            await removeOfferFromProducts(offer); // Remove the offer
            await Offer.findByIdAndDelete(id);
        }
        res.json({ success: true });
    } catch (error) {
        console.log(error);
        res.json({ success: false, error: 'Failed to delete offer' });
    }
};



  const applyOfferToProducts = async (offer) => {
    if (offer.type === 'product') {
        const product = await Product.findById(offer.productId);
        if (product) {
            product.variant.forEach(variant => {
                variant.offerPrice =  Math.round(variant.price - (variant.price * (offer.damount / 100)));
            });
            await product.save();
        }
    } else if (offer.type === 'category') {
        const products = await Product.find({ cetagory: offer.categoryId });
        products.forEach(async (product) => {
            product.variant.forEach(variant => {
                variant.offerPrice = Math.round(variant.price - (variant.price * (offer.damount / 100)));
            });
            await product.save();
        });
    }
};

const removeOfferFromProducts = async (offer) => {
    if (offer.type === 'product') {
        const product = await Product.findById(offer.productId);
        if (product) {
            product.variant.forEach(variant => {
                variant.offerPrice = variant.price; // Revert to original price
            });
            await product.save();
        }
    } else if (offer.type === 'category') {
        const products = await Product.find({ cetagory: offer.categoryId });
        products.forEach(async (product) => {
            product.variant.forEach(variant => {
                variant.offerPrice = variant.price; // Revert to original price
            });
            await product.save();
        });
    }
};
