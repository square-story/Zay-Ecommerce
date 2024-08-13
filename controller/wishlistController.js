const Wishlist = require('../models/wishlistModel');
const Wallet = require('../models/walletModel');

module.exports.loadWhislist = async (req, res) => {
  try {
    const userId = req.session.user?._id;

    if (!userId) {
      return res.status(500).send('User not found');
    }

    const wallet = await Wallet.findOne({ user: userId });
    const walletBalance = wallet ? wallet.balance : 0;

    // Find or create the user's wishlist
    let wishlist = await Wishlist.findOne({ user: userId }).populate('products.productId');

    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, products: [] });
      await wishlist.save();
    }

    const wishlistProducts = wishlist.products; // Access the products array from the wishlist

    res.render('wishlist', { wishlistProducts, walletBalance });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error'); // Send a proper error response
  }
};

module.exports.addTOWhishlist = async (req, res) => {
  try {
    console.log('recived');

    const userId = req.session.user?._id;
    if (!userId) {
      res.status(500).send('user not found');
    }
    const wishlist = await Wishlist.findOne({ user: userId });
    const { productId, index } = req.body;
    if (wishlist) {
      console.log(wishlist);
      const exists = await Wishlist.findOne({
        user: userId,
        'products.productId': productId,
        'products.index': index,
      });
      console.log(exists);
      if (!exists) {
        const data = {
          productId: productId,
          index: index,
        };
        await Wishlist.updateOne(
          { user: userId },
          {
            $push: {
              products: data,
            },
          },
        );
      } else {
        return res.json({ already: true });
      }
    } else {
      const data = {
        productId: productId,
        index: index,
      };
      const newWishlist = new Wishlist({
        user: userId,
        products: data,
      });

      await newWishlist.save();
    }
    res.json({ wishlist: true });
  } catch (error) {
    console.log(error);
  }
};

module.exports.removeFromWishlist = async (req, res) => {
  try {
    console.log('remove wish');
    const userId = req.session.user?._id;
    const { productId, index } = req.body;
    if (!userId) {
      res.status(500).send('user not found');
    }
    await Wishlist.updateOne(
      { user: userId },
      {
        $pull: {
          products: { productId: productId, index: index },
        },
      },
    );
    res.json({ success: true });
  } catch (error) {
    console.log(error);
  }
};
