const Order = require('../models/order');
const Cetagory = require('../models/cetagory');

function bestSelling(sort) {
  try {
    return new Promise(async (resolve, reject) => {
      const bestSellingTopTen = await Order.aggregate([
        {
          $lookup: {
            from: 'products',
            localField: 'products.productId',
            foreignField: '_id',
            as: 'products',
          },
        },
        {
          $unwind: '$products',
        },
        {
          $match: {
            status: 'placed',
          },
        },

        {
          $group: {
            _id: { category: `$products.${sort}` },
            count: { $sum: 1 },
            data: { $first: '$$ROOT' },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
      ]);

      if (!bestSellingTopTen) reject(new Error(`data did'nt recived`));
      resolve(bestSellingTopTen);
    });
  } catch (error) {
    console.log(error);
  }
}

async function mapCategory(cetagory) {
  if (!cetagory || cetagory.length === 0) {
    return [];
  }

  try {
    const promises = cetagory.map(async (el) => {
      // Check if category ID exists before querying
      if (!el._id || !el._id.category) return 'Unknown';
      const cat = await Cetagory.findById(el._id.category);
      return cat ? cat.name : 'Unknown';
    });

    return Promise.all(promises);
  } catch (error) {
    console.error('Error in mapCategory:', error);
    return [];
  }
}

module.exports = {
  bestSelling,
  mapCategory,
};
