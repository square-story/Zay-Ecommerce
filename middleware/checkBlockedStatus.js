const User = require('../models/userModel'); // Adjust the path as needed

const checkBlockedStatus = async (req, res, next) => {
  if (req.session.user) {
    const user = await User.findById(req.session.user._id);
    if (user && user.isBlocked) {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to log out' });
        }
        return res.status(403).json({ error: 'Your account has been blocked' });
      });
    } else {
      next();
    }
  } else {
    next();
  }
};

module.exports = checkBlockedStatus;
