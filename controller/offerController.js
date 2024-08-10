const cron = require('node-cron');
const Offer = require('../models/offerModel');
const Product = require('../models/product');
const Category = require('../models/cetagory');

const formatDate = (date) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
};

const applyOfferToProducts = async (offer) => {
  const now = new Date();

  if (now < offer.adate || now > offer.edate) {
    console.log(`Offer ${offer.name} is not active.`);
    return; // Offer is not active, so we don't apply it
  }

  if (offer.type === 'product') {
    const products = await Product.find({
      _id: { $in: offer.applicableToProducts },
    });
    for (const product of products) {
      if (product.variant && product.variant.length > 0) {
        product.variant.forEach((variant) => {
          if (typeof variant.price === 'number' && !isNaN(variant.price)) {
            variant.offerPrice = Math.round(variant.price - variant.price * (offer.damount / 100));
          } else {
            variant.offerPrice = variant.price; // Fallback to original price if calculation is not possible
          }
        });
        await product.save({ validateBeforeSave: false }); // Skip validation
      }
    }
  } else if (offer.type === 'category') {
    const products = await Product.find({
      cetagory: { $in: offer.applicableToCategories },
    });
    for (const product of products) {
      if (product.variant && product.variant.length > 0) {
        product.variant.forEach((variant) => {
          if (typeof variant.price === 'number' && !isNaN(variant.price)) {
            variant.offerPrice = Math.round(variant.price - variant.price * (offer.damount / 100));
          } else {
            variant.offerPrice = variant.price; // Fallback to original price if calculation is not possible
          }
        });
        await product.save({ validateBeforeSave: false }); // Skip validation
      }
    }
  }
};

const removeOfferFromProducts = async (offer) => {
  const now = new Date();

  if (now < offer.adate || now > offer.edate) {
    console.log(`Offer ${offer.name} is not active.`);
    return; // Offer is not active, so we don't apply changes
  }

  let updateQuery = { $set: {} };

  if (offer.type === 'product') {
    const products = await Product.find({ _id: { $in: offer.applicableToProducts } });
    for (const product of products) {
      product.variant.forEach((variant, index) => {
        updateQuery.$set[`variant.${index}.offerPrice`] = variant.price;
      });
      await Product.updateOne({ _id: product._id }, updateQuery, { validateBeforeSave: false });
      updateQuery.$set = {}; // Reset update query for the next product
    }
  } else if (offer.type === 'category') {
    const products = await Product.find({ cetagory: { $in: offer.applicableToCategories } });
    for (const product of products) {
      product.variant.forEach((variant, index) => {
        updateQuery.$set[`variant.${index}.offerPrice`] = variant.price;
      });
      await Product.updateOne({ _id: product._id }, updateQuery, { validateBeforeSave: false });
      updateQuery.$set = {}; // Reset update query for the next product
    }
  }
};

// Load the admin offer page
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

    res.render('offerOperationPage', {
      offers: formattedOffers,
      products,
      categories,
      successMessages,
      errorMessages,
    });
  } catch (error) {
    req.flash('errorMessages', 'Failed to retrieve offers.');
    res.status(500).redirect('/admin/offer-management');
    console.error('Error loading admin offer page:', error);
  }
};

// Create a new offer
module.exports.createOfferPost = async (req, res) => {
  try {
    const { name, adate, edate, damount, type, productIds, categoryIds } = req.body;
    const discountAmount = parseFloat(damount);

    if (isNaN(discountAmount) || discountAmount <= 0) {
      req.flash('errorMessages', 'Invalid discount amount.');
      return res.redirect('/admin/offer-management');
    }

    if (discountAmount > 100) {
      req.flash('errorMessages', 'Discount amount cannot exceed 100%.');
      return res.redirect('/admin/offer-management');
    }

    const offer = new Offer({
      name,
      adate: new Date(adate),
      edate: new Date(edate),
      damount: discountAmount,
      type,
      applicableToProducts: type === 'product' ? productIds : [],
      applicableToCategories: type === 'category' ? categoryIds : [],
    });

    await offer.save();
    await applyOfferToProducts(offer);

    req.flash('successMessages', 'Offer created successfully.');
    res.redirect('/admin/offer-management');
  } catch (error) {
    req.flash('errorMessages', 'Failed to create offer.');
    res.redirect('/admin/offer-management');
    console.error('Error creating offer:', error);
  }
};

// Edit an existing offer
module.exports.editOfferPost = async (req, res) => {
  try {
    const { id, name, adate, edate, damount, type, productIds, categoryIds } = req.body;
    const discountAmount = parseFloat(damount);

    if (isNaN(discountAmount) || discountAmount <= 0) {
      req.flash('errorMessages', 'Invalid discount amount.');
      return res.redirect('/admin/offer-management');
    }

    if (discountAmount > 100) {
      req.flash('errorMessages', 'Discount amount cannot exceed 100%.');
      return res.redirect('/admin/offer-management');
    }

    const offer = await Offer.findById(id);

    if (!offer) {
      req.flash('errorMessages', 'Offer not found.');
      return res.redirect('/admin/offer-management');
    }

    await removeOfferFromProducts(offer); // Remove old offer

    offer.name = name;
    offer.adate = new Date(adate);
    offer.edate = new Date(edate);
    offer.damount = discountAmount;
    offer.type = type;
    offer.applicableToProducts = type === 'product' ? productIds : [];
    offer.applicableToCategories = type === 'category' ? categoryIds : [];

    await offer.save();
    await applyOfferToProducts(offer); // Apply new offer

    req.flash('successMessages', 'Offer updated successfully.');
    res.redirect('/admin/offer-management');
  } catch (error) {
    req.flash('errorMessages', 'Failed to update offer.');
    res.redirect('/admin/offer-management');
    console.error('Error updating offer:', error);
  }
};

// Delete an offer
module.exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.body;
    const offer = await Offer.findById(id);

    if (offer) {
      await removeOfferFromProducts(offer); // Remove the offer
      await Offer.findByIdAndDelete(id);
      req.flash('successMessages', 'Offer deleted successfully.');
    } else {
      req.flash('errorMessages', 'Offer not found.');
    }

    res.json({ success: true });
  } catch (error) {
    req.flash('errorMessages', 'Failed to delete offer.');
    res.json({ success: false, error: 'Failed to delete offer' });
    console.error('Error deleting offer:', error);
  }
};

// Cron job to check for expired offers and remove them daily at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running cron job to check for expired offers.');

  try {
    const now = new Date();
    const activeOffers = await Offer.find({ adate: { $lte: now }, edate: { $gte: now } });

    for (const offer of activeOffers) {
      try {
        await applyOfferToProducts(offer);
      } catch (error) {
        console.error(`Error applying active offer ${offer._id}:`, error);
      }
    }

    const expiredOffers = await Offer.find({ edate: { $lt: now } });

    for (const offer of expiredOffers) {
      try {
        await removeOfferFromProducts(offer);
        await Offer.findByIdAndDelete(offer._id);
        console.log(`Expired offer ${offer.name} removed successfully.`);
      } catch (error) {
        console.error(`Error processing expired offer ${offer._id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error running cron job:', error);
  }
});

module.exports.checkOfferName = async (req, res) => {
  const { name } = req.body;

  try {
    const existingOffer = await Offer.findOne({ name: name.trim() });

    if (existingOffer) {
      return res.json({ isUnique: false });
    }

    res.json({ isUnique: true });
  } catch (error) {
    console.error('Error checking offer name:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
