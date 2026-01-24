export const userAuth = (req, res, next) => {
  try {
    if (req.session.user) {
      next();
    } else {
      return res.redirect(
        `/login?message=${encodeURIComponent('First You Want to Login')}`
      );
    }
  } catch (error) {
    console.log(error);
  }
};

export const isLogined = (req, res, next) => {
  try {
    if (req.session.user) {
      res.redirect('/');
    } else {
      next();
    }
  } catch (error) {
    console.log(error);
  }
};
