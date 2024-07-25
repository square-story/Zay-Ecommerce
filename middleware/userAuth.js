module.exports.userAuth = (req, res, next) => {
  try {
    if (req.session.user) {
      next();
    } else {
      return res.redirect(`/login?message=${encodeURIComponent('First You Want to Login')}`);
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports.isLogined = (req, res, next) => {
  try {
    if (req.session.user) {
      res.redirect("/");
    } else {
      next();
    }
  } catch (error) {
    console.log(error);
  }
};
