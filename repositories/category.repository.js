import Category from '../models/category.model.js';

class CategoryRepository {
    async getListedCategories() {
        return await Category.find({ isListed: true });
    }
}

export default new CategoryRepository();
