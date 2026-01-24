import shopService from '../services/shop.service.js';

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

      const data = await shopService.getShopData({
        sortOption,
        page,
        limit,
        searchQuery,
        categoryFilter,
        brandFilter,
        priceRange,
      });

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

      const result = await shopService.filterProducts({
        search,
        sort,
        cetagory,
        brand,
        price,
        page,
      });

      if (result) {
        res.status(200).json(result);
      }
    } catch (error) {
      console.log(error);
    }
  };
}

export default new ShopController();
