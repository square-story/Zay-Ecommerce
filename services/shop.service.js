import productRepository from '../repositories/product.repository.js';
import categoryRepository from '../repositories/category.repository.js';
import reviewRepository from '../repositories/review.repository.js';

class ShopService {
    async getShopData({ sortOption, page, limit, searchQuery, categoryFilter, brandFilter, priceRange }) {
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
            categoryRepository.getListedCategories(),
            productRepository.findProducts(filter, sortOrder, skip, limit),
            productRepository.getDistinctBrands(filter),
            productRepository.countDocuments(filter),
        ]);

        const totalPages = Math.ceil(totalResults / limit);

        // Rating logic
        const productObjectIds = products.map((product) => product._id);
        const reviews = await reviewRepository.findByProductIds(productObjectIds);
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

        return {
            categories,
            products,
            productRatings,
            brands,
            totalResults,
            totalPages,
        };
    }

    async filterProducts({ search, sort, cetagory, brand, price, page }) {
        const sortValue = sort === 'increacing' ? 1 : -1;
        const query = {
            name: { $regex: search, $options: 'i' },
        };
        const sortObj = { 'variant.0.price': sortValue };

        const allMatches = await productRepository.searchProducts(query, sortObj);
        const totalPage = allMatches.length / 6;

        const limit = 6;
        const products = await productRepository.searchProductsPaginated(query, sortObj, page * limit, limit);

        if (!products) {
            return null;
        }

        if (cetagory || brand || price) {
            let filteredProduct = [];

            if (cetagory) {
                const result = products.filter((el) => el.cetagory.name == cetagory);
                filteredProduct.push(...result);
            }

            if (brand) {
                const array = cetagory ? filteredProduct : products;
                const result = array.filter((el) => el.brand == brand);
                return { pass: true, product: result };
            }

            if (price) {
                const array = cetagory ? filteredProduct : products;
                const result = array.filter(
                    (el) =>
                        el.variant[0].offerPrice >= parseInt(price[0]) &&
                        el.variant[0].offerPrice <= parseInt(price[1]),
                );
                return { pass: true, product: result };
            }

            return { pass: true, product: filteredProduct };
        } else {
            return { pass: true, product: products, page, totalPage };
        }
    }
}

export default new ShopService();
