import Product from '../models/product.model.js';
import Category from '../models/category.model.js';
import Review from '../models/review.model.js';

class ShopController {
  //products page rendering
  loadShop = async (req, res) => {
    try {
      const sortOption = req.query.sort || 'increasing';
      const page = parseInt(req.query.page) || 1;
      const limit = 6;
      const searchQuery = req.query.search || '';
      const categoryFilter = req.query.category ? req.query.category.split(',') : [];
      const brandFilter = req.query.brand ? req.query.brand.split(',') : [];
      const priceRange = req.query.price ? req.query.price.split('-').map(Number) : null;

      // Logic from ShopService.getShopData
      let sortOrder;
      switch (sortOption) {
        case 'increasing':
          sortOrder = { 'variant.0.offerPrice': 1 };
          break;
        case 'decreasing':
          sortOrder = { 'variant.0.offerPrice': -1 };
          break;
        case 'Aa-Zz':
          sortOrder = { name: 1 };
          break;
        case 'Zz-Aa':
          sortOrder = { name: -1 };
          break;
        case 'newArrival':
          sortOrder = { 'variant.0.created': -1 };
          break;
        case 'rating':
          sortOrder = { rating: -1 };
          break;
        default:
          sortOrder = { 'variant.0.offerPrice': 1 };
      }

      let filter = { isListed: true };
      if (categoryFilter && categoryFilter.length > 0) {
        filter.cetagory = { $in: categoryFilter };
      }
      if (brandFilter && brandFilter.length > 0) {
        filter.brand = { $in: brandFilter };
      }
      if (priceRange) {
        filter['variant.0.offerPrice'] = {
          $gte: priceRange[0],
          $lte: priceRange[1],
        };
      }
      if (searchQuery) {
        filter.name = new RegExp(searchQuery, 'i');
      }

      const skip = (page - 1) * limit;

      const [categories, products, brands, totalResults] = await Promise.all([
        Category.find({ isListed: true }),
        Product.find(filter).sort(sortOrder).skip(skip).limit(limit).populate('cetagory'),
        Product.distinct('brand', filter),
        Product.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(totalResults / limit);

      // Rating logic from ShopService
      const productObjectIds = products.map((product) => product._id);
      const reviews = await Review.find({ productId: { $in: productObjectIds } }).lean();
      const productRatings = {};

      productObjectIds.forEach((id) => {
        const productReviews = reviews.filter(
          (review) => review.productId && review.productId.toString() === id.toString(),
        );
        if (productReviews.length > 0) {
          const totalRating = productReviews.reduce((acc, review) => acc + review.rating, 0);
          productRatings[id.toString()] = Number((totalRating / productReviews.length).toFixed(1));
        } else {
          productRatings[id.toString()] = 0;
        }
      });

      if (sortOption === 'rating') {
        products.sort((a, b) => (productRatings[b._id] || 0) - (productRatings[a._id] || 0));
      }

      const data = {
        categories,
        products,
        productRatings,
        brands,
        totalResults,
        totalPages,
      };

      res.render('shop', {
        categories: data.categories,
        product: data.products,
        productRatings: data.productRatings,
        brands: data.brands,
        totalResults: data.totalResults,
        totalPages: data.totalPages,
        currentPage: page,
        sortOption,
        results: data.products.length,
        categoryFilter,
        brandFilter,
        priceRange,
        searchQuery,
      });
    } catch (error) {
      console.error('Error loading shop:', error);
      res.status(500).send('Server Error');
    }
  };

  filter = async (req, res) => {
    try {
      const search = req.body.search ? req.body.search : '';
      const sort = req.body.sort;
      const cetagory = req.body.cetagory ? req.body.cetagory : false;
      const brand = req.body.brand ? req.body.brand : false;
      const price = req.body.price ? req.body.price.split('-') : false;
      const page = req.body.page;

      // Logic from ShopService.filterProducts
      const sortValue = sort === 'increacing' ? 1 : -1;
      const query = {
        name: { $regex: search, $options: 'i' },
      };
      const sortObj = { 'variant.0.price': sortValue };

      // From productRepository.searchProducts(query, sortObj)
      const allMatches = await Product.find(query).sort(sortObj).populate('cetagory');
      const totalPage = allMatches.length / 6;

      const limit = 6;
      // From productRepository.searchProductsPaginated(query, sortObj, page * limit, limit)
      const products = await Product.find(query)
        .sort(sortObj)
        .populate('cetagory')
        .skip(page * limit)
        .limit(limit);

      if (!products) {
        return null; // Note: original controller didn't handle null return but services did return structure. 
        // However, in the original controller, it checked `if (result)` before sending json. 
        // Here we are inside the controller. 
        // But wait, the original controller code was:
        // const result = await shopService.filterProducts(...)
        // if (result) res.status(200).json(result)
        // So I need to construct `result` here.
      }

      let result;

      if (cetagory || brand || price) {
        let filteredProduct = [];

        if (cetagory) {
          const res = products.filter((el) => el.cetagory.name == cetagory);
          filteredProduct.push(...res);
        }

        if (brand) {
          const array = cetagory ? filteredProduct : products;
          const res = array.filter((el) => el.brand == brand);
          result = { pass: true, product: res };
        } else if (price) { // Merged logic here to match service structure
          const array = cetagory ? filteredProduct : products;
          const res = array.filter(
            (el) =>
              el.variant[0].offerPrice >= parseInt(price[0]) &&
              el.variant[0].offerPrice <= parseInt(price[1]),
          );
          result = { pass: true, product: res };
        } else {
          result = { pass: true, product: filteredProduct };
        }
      } else {
        result = { pass: true, product: products, page, totalPage };
      }

      if (result) {
        res.status(200).json(result);
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error filtering products' }); // Added error response
    }
  };
}

export default new ShopController();
