const cron = require("node-cron");
const Offer = require("../models/offerModel");
const Product = require("../models/product");
const Category = require("../models/cetagory");

const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

module.exports.loadAdminOfferPage = async (req, res) => {
  try {
    const offers = await Offer.find({});
    const products = await Product.find({});
    const categories = await Category.find({});

    // Format the dates before passing them to the template
    const formattedOffers = offers.map((offer) => ({
      ...offer.toObject(),
      adate: formatDate(offer.adate),
      edate: formatDate(offer.edate),
    }));

    // Load flash messages
    const successMessages = req.flash('successMessages');
    const errorMessages = req.flash('errorMessages');

    res.render("offerOperationPage", { 
      offers: formattedOffers, 
      products, 
      categories, 
      successMessages, 
      errorMessages 
    });
  } catch (error) {
    req.flash('errorMessages', 'Failed to retrieve offers');
    res.status(500).redirect("/admin/offer-management");
    console.log(error);
  }
};

//offer create
module.exports.createOfferPost = async (req, res) => {
  try {
    const { name, adate, edate, damount, type, productIds, categoryIds } =
      req.body;
      const discountAmount = parseFloat(damount);
      if (isNaN(discountAmount) || discountAmount <= 0) {
        return res.status(400).json({ error: 'Invalid discount amount' });
      }
      console.log(typeof damount)

        // Check if the discount amount is more than 100%
      if (damount > 100) {
        req.flash('errorMessages', 'Discount amount cannot exceed 100%.');
        return res.redirect('/admin/offer-management');
      }

    const offer = new Offer({
      name,
      adate:new Date(adate),
      edate: new Date(edate),
      damount:discountAmount,
      type,
      applicableToProducts: type === "product" ? productIds : [],
      applicableToCategories: type === "category" ? categoryIds : [],
    });
    await offer.save();
    await applyOfferToProducts(offer);
    req.flash('successMessages', 'Offer created successfully.');
    res.redirect("/admin/offer-management");
  } catch (error) {
    req.flash('errorMessages', 'Failed to create offer.');
    res.redirect('/admin/offer-management');
  }
};

//edit offer
module.exports.editOfferPost = async (req, res) => {
  try {
    const { id, name, adate, edate, damount, type, productIds, categoryIds } =
      req.body;

        // Convert damount to a number
  const discountAmount = parseFloat(damount);
  if (isNaN(discountAmount) || discountAmount <= 0) {
    return res.status(400).json({ error: 'Invalid discount amount' });
  }

    // Check if the discount amount is more than 100%
    if (damount > 100) {
      req.flash('errorMessages', 'Discount amount cannot exceed 100%.');
      return res.redirect('/admin/offer-management');
    }


    const offer = await Offer.findById(id);

    if (!offer) {
      req.flash('errorMessages', 'Offer not found.');
      return res.redirect('/admin/offers');
    }
    await removeOfferFromProducts(offer); // Remove old offer

    offer.name = name;
    offer.adate = new Date(adate);
    offer.edate = new Date(edate);
    offer.damount = discountAmount;
    offer.type = type;
    offer.applicableToProducts = type === "product" ? productIds : [];
    offer.applicableToCategories = type === "category" ? categoryIds : [];
    await offer.save();
    await applyOfferToProducts(offer); // Apply new offer
    req.flash('successMessages', 'Offer updated successfully.');
    res.redirect("/admin/offer-management");
  } catch (error) {
    req.flash('errorMessages', 'Failed to update offer.');
    res.redirect("/admin/offer-management");
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

// Define a cron job to run every day at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("Running cron job to check for expired offers.");

  try {
    // Find expired offers
    const expiredOffers = await Offer.find({ edate: { $lt: new Date() } });

    // Process each expired offer
    for (const offer of expiredOffers) {
      // Remove offer from products
      await removeOfferFromProducts(offer);

      // Delete the offer from the database
      await Offer.findByIdAndDelete(offer._id);
    }
  } catch (error) {
    console.error("Error processing expired offers:", error);
  }
});


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
