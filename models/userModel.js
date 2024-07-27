const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
  },

  mobile: {
    type: String,
    required: true,
  },

  password: {
    type: String,
    required: true,
  },

  isBlocked: {
    type: Boolean,
    default: false,
  },

  verified: {
    type: Boolean,
    default: false,
  },

  created: {
    type: Date,
    default: Date.now,
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Wallet",
  },
});

module.exports = mongoose.model("User", userSchema);
