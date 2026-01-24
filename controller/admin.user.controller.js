import User from '../models/user.model.js';

class AdminUserController {
    // user page loding with data
    loadUser = async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 0;
            const searchQuery = req.query.search || '';

            // Create a filter based on the search query
            const filter = searchQuery ? { name: { $regex: searchQuery, $options: 'i' } } : {};

            // Get the total count of users matching the filter
            const userCount = await User.countDocuments(filter);

            // Fetch the users with pagination and search applied
            const users = await User.find(filter)
                .skip(page * 4)
                .limit(4);

            // Render the user management page with the data
            res.render('userManagement', {
                users: users,
                userLength: Math.ceil(userCount / 4), // Total pages
                page: page,
                searchQuery: searchQuery, // Pass the search query to the view
            });
        } catch (error) {
            console.log(error);
            res.status(500).send('Error loading users');
        }
    };

    // blocking an user
    blockUser = (req, res) => {
        const id = req.body.id;
        console.log(id);

        return User.findOne({ _id: id })
            .then((user) => {
                if (user.isBlocked) {
                    console.log(user);
                    console.log('unblock');
                    return User.updateOne(
                        { _id: id },
                        {
                            $set: {
                                isBlocked: false,
                            },
                        },
                    );
                } else {
                    console.log('block');
                    return User.updateOne(
                        { _id: id },
                        {
                            $set: {
                                isBlocked: true,
                            },
                        },
                    );
                }
            })
            .then(() => {
                res.json({ block: true });
            })
            .catch((err) => {
                console.log(err);
            });
    };
}

export default new AdminUserController();
