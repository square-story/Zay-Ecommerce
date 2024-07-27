const Wishlist = require("../models/wishlistModel");
const Wallet = require("../models/walletModel");

module.exports.loadWhislist = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const wallet = await Wallet.findOne({ user: userId });
    const walletBalance = wallet ? wallet.balance : 0;
    if (!userId) {
      return res.status(500).send("user not found");
    }

    const products = await Wishlist.find({ user: userId }).populate(
      "products.productId"
    );

    // Check for empty results
    if (!products || !products.length) {
      return res.render("404"); // Or send a different response
    }

    const wishlistProducts = products[0].products; // Access only if products exists
    res.render("wishlist", { wishlistProducts, walletBalance });
  } catch (error) {
    console.log(error);
  }
};

module.exports.addTOWhishlist = async (req, res) => {
  try {
    console.log("recived");

    const userId = req.session.user?._id;
    if (!userId) {
      res.status(500).send("user not found");
    }
    const wishlist = await Wishlist.findOne({ user: userId });
    const { productId, index } = req.body;
    if (wishlist) {
      console.log(wishlist);
      const exists = await Wishlist.findOne({
        user: userId,
        "products.productId": productId,
        "products.index": index,
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
          }
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
    console.log("remove wish");
    const userId = req.session.user?._id;
    const { productId, index } = req.body;
    if (!userId) {
      res.status(500).send("user not found");
    }
    await Wishlist.updateOne(
      { user: userId },
      {
        $pull: {
          products: { productId: productId, index: index },
        },
      }
    );
    res.json({ success: true });
  } catch (error) {
    console.log(error);
  }
};
