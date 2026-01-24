import Review from '../models/review.model.js';

class ReviewRepository {
    async findByProductIds(productIds) {
        return await Review.find({ productId: { $in: productIds } }).lean();
    }
}

export default new ReviewRepository();
