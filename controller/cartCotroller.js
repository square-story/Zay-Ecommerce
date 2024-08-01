const Product = require('../models/product');
const Cart = require('../models/cartModel');
const Address = require('../models/address');
const Wallet = require('../models/walletModel');
const Coupon = require('../models/couponModel');

module.exports.loadCart = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const product = await Cart.find({ user: userId }, { products: 1 }).populate(
      'products.productId'
    );
    const products = product[0]?.products;
    console.log(products, 'cart');
    res.render('cart', { products: products });
  } catch (error) {
    console.log(error);
  }
};

module.exports.addToCart = async (req, res) => {
  try {
    const { productId, index, size, quantity } = req.body;
    const userId = req.session.user?._id;
    if (!userId) {
      return res.json({ user: true });
    }
    const maxQuantityPerPerson = 5; // Example: Hard-coded for demonstration
    console.log(productId, index, userId, size, quantity);
    if (quantity > maxQuantityPerPerson) {
      return res
        .status(400)
        .json({ error: 'Exceeded maximum quantity per person.' });
    }
    // price of the variant
    const product = await Product.findOne({ _id: productId });
    const price = product.variant[index].price;
    const offerPrice = product.variant[index].offerPrice;
    console.log(offerPrice, price);
    const qnt = quantity ? quantity : 1;

    if (userId) {
      const cart = await Cart.findOne({ user: userId });
      if (cart) {
        const exsisting = cart.products.filter(
          (product, i) => product.productId.toString() === productId
        );
        console.log(exsisting, ' product');
        const exits = exsisting.find(
          (pro) => pro.product === index && pro.size === size
        );
        if (!exits) {
          console.log('addd');
          await Cart.findOneAndUpdate(
            { user: userId },
            {
              $push: {
                products: {
                  productId: productId,
                  product: index,
                  price: offerPrice,
                  quantity: qnt,
                  totalPrice: offerPrice * qnt,
                  size: size,
                },
              },
            }
          );
        } else {
          console.log('hello');
          return res.json({ already: true });
        }
      } else {
        console.log('created');
        console.log(price);

        const product = {
          productId: productId,
          product: index,
          price: offerPrice,
          quantity: qnt,
          totalPrice: offerPrice * qnt,
          size: size,
        };
        console.log(product);

        const cart = new Cart({
          user: userId,
          products: product,
        });

        if (cart) {
          await cart.save();
        }
      }

      res.json({ added: true });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const { productId, index, size } = req.body;
    console.log(req.body);

    if (userId) {
      await Cart.updateOne(
        {
          user: userId,
          'products.productId': productId,
          'products.product': index,
          'products.size': size,
        },
        {
          $pull: {
            products: { productId: productId, product: index, size: size },
          },
        },
        {
          arrayFilters: [
            {
              'elem.productId': productId,
              'elem.product': index,
              'elem.size': size,
            },
          ],
        }
      );
      res.json({ removed: true });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports.changeQuantity = async (req, res) => {
  try {
    const { status, productId, index, size } = req.body;
    const userId = req.session.user?._id;

    if (!userId || !productId || index === undefined || !size) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const product = await Product.findOne({ _id: productId });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const variant = product.variant[index];
    if (!variant) {
      return res.status(400).json({ error: 'Invalid product variant' });
    }
    const stock = variant.stock;
    const price = variant.offerPrice;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const cartProduct = cart.products.find(
      (pro) =>
        pro.productId.toString() === productId &&
        pro.product === index &&
        pro.size === size
    );
    if (!cartProduct) {
      return res.status(404).json({ error: 'Cart product not found' });
    }

    const quantity = cartProduct.quantity;

    if (status === 'plus') {
      if (quantity >= 5) {
        return res.status(400).json({ error: 'Maximum quantity of 5 reached' });
      } else if (stock > quantity) {
        await Cart.updateOne(
          {
            user: userId,
            'products.productId': productId,
            'products.product': index,
            'products.size': size,
          },
          {
            $inc: { 'products.$[elem].quantity': 1 },
            $set: { 'products.$[elem].totalPrice': (quantity + 1) * price },
          },
          {
            arrayFilters: [
              {
                'elem.productId': productId,
                'elem.product': index,
                'elem.size': size,
              },
            ],
          }
        );
        return res.json({ changed: true });
      } else {
        return res.status(400).json({ error: 'Out of stock' });
      }
    } else if (status === 'minus') {
      if (quantity > 1) {
        await Cart.updateOne(
          {
            user: userId,
            'products.productId': productId,
            'products.product': index,
            'products.size': size,
          },
          {
            $inc: { 'products.$[elem].quantity': -1 },
            $set: { 'products.$[elem].totalPrice': (quantity - 1) * price },
          },
          {
            arrayFilters: [
              {
                'elem.productId': productId,
                'elem.product': index,
                'elem.size': size,
              },
            ],
          }
        );
        return res.json({ changed: true });
      } else {
        return res
          .status(400)
          .json({ error: 'Quantity cannot be less than 1' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid status value' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports.proceedToCheckout = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const address = await Address.findOne({ user: userId });
    const cart = await Cart.findOne({ user: userId }).populate(
      'products.productId'
    );
    const coupon = await Coupon.find();
    const wallet = await Wallet.findOne({ user: userId });
    const walletBalance = wallet ? wallet.balance : 0;

    // Calculate subtotal
    const subtotal = cart.products.reduce(
      (acc, product) => acc + product.totalPrice,
      0
    );

    // Calculate delivery charge
    const deliveryCharge = subtotal < 500 ? 80 : 0;

    // Calculate discount
    let discount = 0;
    // Assume no coupon applied here for simplicity; you'll handle this in your actual coupon application logic
    // If a coupon is applied, calculate the discount and adjust the final amount accordingly

    // Calculate final amount
    const finalAmount = subtotal + deliveryCharge - discount;

    res.render('checkOut', {
      address: address,
      products: cart.products,
      subtotal,
      deliveryCharge,
      discount,
      finalAmount,
      walletBalance,
      coupon,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
};
