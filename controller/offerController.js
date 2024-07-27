const Offer = require("../models/offerModel");
const Product = require("../models/product");
const Category = require("../models/cetagory");

//offer operation page render
module.exports.loadAdminOfferPage = async (req, res) => {
  try {
    const offers = await Offer.find({});
    const products = await Product.find({});
    const categories = await Category.find({});
    res.render("offerOperationPage", { offers, products, categories });
  } catch (error) {
    res.status(500).send("Failed to retrieve offers");
    console.log(error);
  }
};

//offer create
module.exports.createOfferPost = async (req, res) => {
  try {
    const { name, adate, edate, damount, type, productIds, categoryIds } =
      req.body;
    const offer = new Offer({
      name,
      adate,
      edate,
      damount,
      type,
      applicableToProducts: type === "product" ? productIds : [],
      applicableToCategories: type === "category" ? categoryIds : [],
    });
    await offer.save();
    await applyOfferToProducts(offer);
    res.redirect("/admin/offer-management");
  } catch (error) {
    res.status(500).send(error.message);
  }
};

//edit offer
module.exports.editOfferPost = async (req, res) => {
  try {
    const { id, name, adate, edate, damount, type, productIds, categoryIds } =
      req.body;
    const offer = await Offer.findById(id);
    await removeOfferFromProducts(offer); // Remove old offer
    offer.name = name;
    offer.adate = adate;
    offer.edate = edate;
    offer.damount = damount;
    offer.type = type;
    offer.applicableToProducts = type === "product" ? productIds : [];
    offer.applicableToCategories = type === "category" ? categoryIds : [];
    await offer.save();
    await applyOfferToProducts(offer); // Apply new offer
    res.redirect("/admin/offer-management");
  } catch (error) {
    res.status(500).send(error.message);
  }
};

//delete offer
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
    res.json({ success: false, error: "Failed to delete offer" });
  }
};

const applyOfferToProducts = async (offer) => {
  if (offer.type === "product") {
    const products = await Product.find({
      _id: { $in: offer.applicableToProducts },
    });
    for (const product of products) {
      product.variant.forEach((variant) => {
        variant.offerPrice = Math.round(
          variant.price - variant.price * (offer.damount / 100)
        );
      });
      await product.save();
    }
  } else if (offer.type === "category") {
    const products = await Product.find({
      cetagory: { $in: offer.applicableToCategories },
    });
    for (const product of products) {
      product.variant.forEach((variant) => {
        variant.offerPrice = Math.round(
          variant.price - variant.price * (offer.damount / 100)
        );
      });
      await product.save();
    }
  }
};

const removeOfferFromProducts = async (offer) => {
  if (offer.type === "product") {
    const products = await Product.find({
      _id: { $in: offer.applicableToProducts },
    });
    for (const product of products) {
      product.variant.forEach((variant) => {
        variant.offerPrice = variant.price; // Revert to original price
      });
      await product.save();
    }
  } else if (offer.type === "category") {
    const products = await Product.find({
      cetagory: { $in: offer.applicableToCategories },
    });
    for (const product of products) {
      product.variant.forEach((variant) => {
        variant.offerPrice = variant.price; // Revert to original price
      });
      await product.save();
    }
  }
};
