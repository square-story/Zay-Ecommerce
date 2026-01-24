import Catagery from '../models/category.model.js';
import product from '../models/product.model.js';

class AdminProductController {
    // load product management page
    loadPoduct = async (req, res) => {
        const search = req.query.search;
        const categoryFilter = req.query.category; // New category filter
        const page = parseInt(req.query.page) || 0; // Default to 0 if not provided
        const limit = 4; // Number of products per page

        // Build search query
        let query = {};
        if (search || categoryFilter) {
            query.$and = [];
            if (search) {
                query.$and.push({
                    $or: [
                        { name: new RegExp(search, 'i') }, // Case-insensitive search in name
                    ],
                });
            }
            if (categoryFilter) {
                query.$and.push({ cetagory: categoryFilter });
            }
        }

        try {
            // Get all categories for the filter dropdown
            const allCategories = await Catagery.find({ isListed: true });

            // Get the total number of products matching the search query
            const totalProducts = await product.countDocuments(query);

            // Get the products with pagination and search query
            const products = await product
                .find(query)
                .populate('cetagory')
                .skip(page * limit)
                .limit(limit)
                .exec();

            res.render('adminProducts', {
                products,
                productLength: totalProducts,
                page,
                search,
                selectedCategory: categoryFilter,
                categories: allCategories, // Pass categories to view
                limit,
            });
        } catch (error) {
            console.log(error);
            res.status(500).send('Server Error');
        }
    };

    // load add product page
    loadAddProduct = async (req, res) => {
        try {
            console.log('Loading add product page...');
            const data = await Catagery.find();

            // Safely log category count instead of unsafe array access
            console.log(`Loaded ${data.length} categories`);

            res.render('addProduct', {
                cetagory: data,
                messages: {
                    blocked: req.flash('blocked'),
                    pass: req.flash('pass'),
                    found: req.flash('found'),
                },
                data: req.flash('data')[0] || {},
            });
        } catch (error) {
            console.log('Error loading add product page:', error);
            res.status(500).send('Internal Server Error');
        }
    };
}

export default new AdminProductController();
