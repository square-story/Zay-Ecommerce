const Catagery = require("../models/cetagory");
const Product = require("../models/product");
const Review = require('../models/reviewModal');

//products page rendering
module.exports.loadShop = async (req, res) => {
  try {
    const sortOption = req.query.sort || "increasing"; // Default to 'increasing'
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = 6; // Number of products per page
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search || ""; // Extract search query from request query params
    const categoryFilter = req.query.category || null;
    const brandFilter = req.query.brand || null;
    const priceRange = req.query.price
      ? req.query.price.split("-").map(Number)
      : null;

    let sortOrder;
    switch (sortOption) {
      case "increasing":
        sortOrder = { "variant.0.offerPrice": 1 };
        break;
      case "decreasing":
        sortOrder = { "variant.0.offerPrice": -1 };
        break;
      case "Aa-Zz":
        sortOrder = { name: 1 };
        break;
      case "Zz-Aa":
        sortOrder = { name: -1 };
        break;
      case "newArrival":
        sortOrder = { "variant.0.created": -1 };
        break;
      default:
        sortOrder = { "variant.0.offerPrice": 1 };
    }

    let filter = { isListed: true };
    if (categoryFilter) {
      filter.cetagory = categoryFilter; // Adjusted to match your schema field name
    }

    if (brandFilter) {
      filter.brand = brandFilter;
    }

    if (priceRange) {
      filter["variant.offerPrice"] = {
        $gte: priceRange[0],
        $lte: priceRange[1],
      };
    }
    if (searchQuery) {
      filter.name = new RegExp(searchQuery, "i"); // Case-insensitive search by product name
    }

    const categories = await Catagery.find({ isListed: true });
    const products = await Product.find(filter)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit)
      .populate("cetagory"); // Ensure 'cetagory' matches the field in your Product model

    const brands = await Product.distinct("brand", filter);
    const totalResults = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalResults / limit);

    // Fetch reviews and calculate average rating
    const productIds = products.map(product => product._id.toString());
    const reviews = await Review.find({ product: { $in: productIds } });

    const productRatings = {};
    productIds.forEach(id => {
      const productReviews = reviews.filter(review => review.product.toString() === id);
      if (productReviews.length > 0) {
        const totalRating = productReviews.reduce((acc, review) => acc + review.rating, 0);
        productRatings[id] = (totalRating / productReviews.length).toFixed(1);
      } else {
        productRatings[id] = 0;
      }
    });

    res.render("shop", {
      categories,
      product: products,
      brands,
      totalResults,
      totalPages,
      currentPage: page,
      sortOption,
      results: products.length,
      categoryFilter,
      brandFilter,
      priceRange,
      searchQuery, // Pass searchQuery to template for rendering
      productRatings, // Pass product ratings to the template
    });
  } catch (error) {
    console.error("Error loading shop:", error);
    res.status(500).send("Server Error");
  }
};





module.exports.filter = async (req, res) => {
  try {
    const search = req.body.search ? req.body.search : "";
    const sort = req.body.sort === "increacing" ? 1 : -1;
    const cetagory = req.body.cetagory ? req.body.cetagory : false;
    const brand = req.body.brand ? req.body.brand : false;
    const price = req.body.price ? req.body.price.split("-") : false;
    const page = req.body.page;

    console.log(page);

    const productCount = await Product.find({
      name: { $regex: search, $options: "i" },
    })
      .sort({ "variant.0.price": sort })
      .populate("cetagory");
    const totalPage = productCount.length / 6;
    const products = await Product.find({
      name: { $regex: search, $options: "i" },
    })
      .sort({ "variant.0.price": sort })
      .populate("cetagory")
      .skip(page * 6)
      .limit(6);
    console.log(products);
    if (products) {
      if (cetagory || brand || price) {
        let product = [];

        if (cetagory) {
          const result = products.filter(
            (el, i) => el.cetagory.name == cetagory
          );
          product.push(...result);
        }

        if (brand) {
          const array = cetagory ? product : products;
          const result = array.filter((el, i) => el.brand == brand);
          res.status(200).json({ pass: true, product: result });
        }

        if (price) {
          const array = cetagory ? product : products;
          const result = array.filter(
            (el, i) =>
              el.variant[0].offerPrice >= parseInt(price[0]) &&
              el.variant[0].offerPrice <= parseInt(price[1])
          );
          res.status(200).json({ pass: true, product: result });
        }
        res.status(200).json({ pass: true, product: product });
      } else {
        res
          .status(200)
          .json({ pass: true, product: products, page, totalPage });
      }
    }
  } catch (error) {
    console.log(error);
  }
};
