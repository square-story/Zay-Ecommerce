const express = require("express");
const app = express();
const mongoose = require("mongoose");

//for logging
app.use((req, res, next) => {
  console.log(req.path, req.method);
  next(); 
});

// Using method-override allows you to leverage RESTful API design principles where you can use different HTTP verbs (GET, POST, PUT, DELETE, PATCH) to perform specific actions on your resources.
const methodOverried = require("method-override");
app.use(methodOverried("_method"));

//for flash notification
const flash = require("express-flash");
app.use(flash());

//view engine set
app.set("view engine", "ejs");
app.set("views", "./views/user");

//the static files location set
const path = require("node:path");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "public/assets")));

//user route and home route
const userRoute = require("./router/userRoute");
app.use("/", userRoute);
//admin route
const adminRoute = require("./router/adminRoute");
app.use("/admin", adminRoute);

//for other route (error handiling with redirect to this page)
app.use("*", (req, res) => {
  res.render("404");
});

//db connection
mongoose
  .connect("mongodb://localhost:27017/zaydb")
  .then(() => {
    console.log("DB connected");
  })
  .catch((err) => {
    console.log(err);
  });

  //server listerning in 3000 port
app.listen(3000, () => {
  console.log("http://localhost:3000");
});
