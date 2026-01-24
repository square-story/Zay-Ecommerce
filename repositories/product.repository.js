import Product from '../models/product.model.js';

class ProductRepository {
    async findProducts(filter, sortOrder, skip, limit) {
        return await Product.find(filter)
            .sort(sortOrder)
            .skip(skip)
            .limit(limit)
            .populate('cetagory');
    }

    async countDocuments(filter) {
        return await Product.countDocuments(filter);
    }

    async getDistinctBrands(filter) {
        return await Product.distinct('brand', filter);
    }

    async searchProducts(query, sort) {
        return await Product.find(query)
            .sort(sort)
            .populate('cetagory');
    }

    async searchProductsPaginated(query, sort, skip, limit) {
        return await Product.find(query)
            .sort(sort)
            .populate('cetagory')
            .skip(skip)
            .limit(limit);
    }
}

export default new ProductRepository();
