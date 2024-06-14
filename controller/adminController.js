const User = require("../models/userModel");
const Catagery = require("../models/cetagory");
const bcrypt = require("bcrypt");
const product = require("../models/product");
require("dotenv").config();


// load admin home page
module.exports.loadAdmin = async (req, res) => {
  try {
    res.render("adminDashboard");
  } catch (error) {
    console.log(error);
  }
};

//filtering dashboard with functional graph (doesn't working now)
module.exports.filterDashboard = async (req, res) => {
  try {
    const { data } = req.body;
    const desiredMonth = data; // Example for January 2024
    const startDate = new Date(desiredMonth + "-01T00:00:00Z"); // Start of month
    const endDate = new Date(desiredMonth + "-31T23:59:59Z"); // End of month (adjusted for days in February)
    console.log(startDate);
    const monthData = await Order.aggregate([
      {
        $match: {
          status: "placed",
          date: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%d",
              date: "$date",
            },
          },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);
    console.log(monthData);

    // Initialize an array with 12 elements, each set to zero
    const newData = Array.from({ length: 30 }).fill(0);

    // Populate the array based on the provided data
    monthData.forEach((item) => {
      console.log(item);
      const monthIndex = parseInt(item._id, 10) - 1; // Convert _id to zero-based index
      if (monthIndex >= 0 && monthIndex < 30) {
        newData[monthIndex] = item.totalAmount;
      }
    });

    console.log(newData);
    res.json({ newData, data });
  } catch (error) {
    console.log(error);
  }
};

// admin login

module.exports.loadLogin = (req, res) => {
  try {
    res.render("admin-login");
  } catch (error) {
    console.log(error);
  }
};

//admin checking the details where the get from admin login
module.exports.login = async (req, res) => {
  try {
    const email = process.env.email;
    const password = process.env.password;
    console.log(email, password);

    if (req.body.email == email) {
      if (req.body.password == password) {
        req.session.admin = email;
        res.redirect("/admin/");
      } else {
        req.flash("password", "incorrect password");
        res.redirect("/admin/login");
        console.log("Incorrect password");
      }
    } else {
      req.flash("email", "Enter valid email address");
      res.redirect("/admin/login");
      console.log("incorrect email");
    }
  } catch (error) {}
};

//user page loding with data
module.exports.loadUser = async (req, res) => {
  try {
    const page = req.query.page;
    const userCount = await User.find();
    return User.find()
      .skip(page * 4)
      .limit(4)
      .then((user) => {
        res.render("userManagement", {
          users: user,
          userLength: userCount.length,
          page: parseInt(page),
        });
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (error) {
    console.log(error);
  }
};

//blocking an user
module.exports.blockUser = (req, res) => {
  const id = req.body.id;
  console.log(id);

  return User.findOne({ _id: id })
    .then((user) => {
      if (user.isBlocked) {
        console.log(user);
        console.log("unblock");
        return User.updateOne(
          { _id: id },
          {
            $set: {
              isBlocked: false,
            },
          }
        );
      } else {
        console.log("block");
        return User.updateOne(
          { _id: id },
          {
            $set: {
              isBlocked: true,
            },
          }
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

// load product management page
module.exports.loadPoduct = async (req, res) => {
  try {
    const page = req.query.page;
    const productLength = await product.find();
    return product
      .find()
      .populate("cetagory")
      .skip(page * 4)
      .limit(4)
      .then((data) => {
        res.render("adminProducts", {
          products: data,
          productLength: productLength.length,
          page: parseInt(page),
        });
      });
  } catch (error) {
    console.log(error);
  }
};

// load add product page

module.exports.loadAddProduct = (req, res) => {
  try {
    return Catagery.find()
      .then((data) => {
        console.log(data[1].name);
        res.render("addProduct", { cetagory: data });
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (error) {
    console.log(error);
  }
};

//logout page collection
module.exports.logout = (req, res) => {
  try {
    req.session.admin = null;
    res.redirect("/admin/login");
  } catch (error) {
    console.log(error);
  }
};
