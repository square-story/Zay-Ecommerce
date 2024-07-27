const Wallet = require("../models/walletModel");

// Function to update wallet balance
module.exports.updateWallet = async (userId, amount, type, description) => {
  try {
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      // Create a new wallet for the user if not found
      wallet = new Wallet({
        user: userId,
        balance: 0,
        transactions: [],
      });
    }

    if (type === "credit") {
      wallet.balance += amount;
    } else if (type === "debit") {
      if (wallet.balance < amount) {
        throw new Error("Insufficient balance");
      }
      wallet.balance -= amount;
    } else {
      throw new Error("Invalid transaction type");
    }

    wallet.transactions.push({
      userId: userId,
      amount: amount,
      type: type,
      description: description,
      date: new Date(),
    });

    await wallet.save();

    return { success: true };
  } catch (error) {
    console.error("Error updating wallet:", error);
    return { success: false, error: error.message };
  }
};
