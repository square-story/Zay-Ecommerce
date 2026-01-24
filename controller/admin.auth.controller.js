class AdminAuthController {
    // admin login
    loadLogin = (req, res) => {
        try {
            res.render('admin-login');
        } catch (error) {
            console.log(error);
        }
    };

    // admin checking the details where the get from admin login
    login = async (req, res) => {
        try {
            const email = process.env.EMAIL;
            const password = process.env.PASSWORD;

            if (req.body.email == email) {
                if (req.body.password == password) {
                    req.session.admin = email;
                    res.redirect('/admin/');
                } else {
                    req.flash('password', 'incorrect password');
                    res.redirect('/admin/login');
                }
            } else {
                req.flash('email', 'Enter valid email address');
                res.redirect('/admin/login');
            }
        } catch (error) {
            console.log(error);
        }
    };

    // logout page collection
    logout = (req, res) => {
        try {
            req.session.admin = null;
            res.redirect('/admin/login');
        } catch (error) {
            console.log(error);
        }
    };
}

export default new AdminAuthController();
