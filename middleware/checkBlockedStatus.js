const User = require('../models/userModel'); // Adjust the path as needed

const checkBlockedStatus = async (req, res, next) => {
  if (req.session.user) {
    try {
      const user = await User.findById(req.session.user._id);
      if (user && user.isBlocked) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Failed to log out:', err);
            return res.status(500).json({ error: 'Failed to log out' });
          }
          // Optionally, you can redirect the user to the login page with a message
          return res.redirect(
            `/login?message=${encodeURIComponent(
              'Your account has been blocked'
            )}`
          );
        });
      } else {
        next();
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    next();
  }
};

module.exports = checkBlockedStatus;
