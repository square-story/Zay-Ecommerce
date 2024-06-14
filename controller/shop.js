const Catagery = require("../models/cetagory");
const Product = require("../models/product");


//products page rendering
module.exports.loadShop = async (req, res) => {
  try {
    const page = 1;
    const cetagory = await Catagery.find({ isListed: true });
    const product = await Product.find({ isListed: true }).populate("cetagory");
    const brand = await Product.find({}, { brand: 1 });

    console.log(product);
    console.log(brand, brand);
    const totalPage = product.length / 2;
    console.log(totalPage);
    res.render("shop", {
      cetagory: cetagory,
      product: product,
      brand: brand,
      page,
      totalPage,
      results: product.length,
    });
  } catch (error) {
    console.log(error);
  }
};
