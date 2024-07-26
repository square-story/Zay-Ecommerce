const cron = require('node-cron');
const Product = require('../models/product'); // Adjust the path as needed
const Offer = require('../models/offerModel'); // Adjust the path as needed

// Define a cron job to run every day at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running cron job to check for expired offers.');

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
    console.error('Error processing expired offers:', error);
  }
});
