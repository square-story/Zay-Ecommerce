const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  balance: {
    type: Number,
    default: 0,
  },
  walletHistory: [
    {
      date: {
        type: Date,
        default: Date.now,
      },
      transactionType: {
        type: String,
        enum: ["credit", "debit"],
      },
      amount: {
        type: Number,
      },
      details: {
        type: String,
      },
    },
  ],
});

module.exports = mongoose.model("Wallet", walletSchema);
