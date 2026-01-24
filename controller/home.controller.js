import Product from '../models/product.model.js';
import Review from '../models/review.model.js';

class HomeController {
    // load home page
    loadHome = async (req, res) => {
        try {
            const featuredProductCount = 3;
            const product = await Product.find({ isListed: true })
                .sort({ created: -1 })
                .limit(featuredProductCount)
                .populate('cetagory');

            const productObjectIds = product.map((product) => product._id);
            const reviews = await Review.find({
                productId: { $in: productObjectIds },
            }).lean();
            const productRatings = {};
            const reviewCounts = {};

            productObjectIds.forEach((id) => {
                const productReviews = reviews.filter(
                    (review) => review.productId && review.productId.toString() === id.toString(),
                );
                if (productReviews.length > 0) {
                    const totalRating = productReviews.reduce((acc, review) => acc + review.rating, 0);
                    productRatings[id.toString()] = Number((totalRating / productReviews.length).toFixed(1));
                    reviewCounts[id.toString()] = productReviews.length;
                } else {
                    productRatings[id.toString()] = 0;
                    reviewCounts[id.toString()] = 0;
                }
            });

            if (product) {
                res.render('home', { product: product, title: 'Zay fashion', productRatings, reviewCounts });
            }
        } catch (error) {
            console.log(error);
        }
    };

    loadAbout = (req, res) => {
        try {
            res.render('aboutUs');
        } catch (error) { }
    };

    loadContact = (req, res) => {
        try {
            res.render('contact');
        } catch (error) { }
    };
}

export default new HomeController();
