# Zay E-commerce Project

Welcome to the Zay E-commerce Project! This project is a comprehensive e-commerce platform built using Node.js, Express, MongoDB, EJS, AJAX, JavaScript, HTML, Bootstrap, and CSS. It includes various features such as product management, cart operations, order tracking, payment integrations, and more.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Features

- User Authentication (Sign Up, Sign In, Logout)
- Product Management (Add, Edit, Delete, View Products)
- Cart Operations (Add to Cart, Remove from Cart, Update Quantities)
- Order Management (Place Orders, Track Orders, Cancel Orders, Return Orders)
- Payment Integration (Razorpay, Wallet)
- Offers and Discounts (Product-wise, Category-wise)
- Responsive Design for Mobile Devices
- Admin Dashboard for Managing Products and Orders
- User Reviews and Ratings for Products
- Invoice Download and Address Management

## Tech Stack

- **Frontend:** HTML, CSS, Bootstrap, EJS, JavaScript, AJAX
- **Backend:** Node.js, Express
- **Database:** MongoDB
- **Payment Gateway:** Razorpay

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/square-story/zay-ecommerce.git
   cd zay-ecommerce
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up environment variables:

Create a .env file in the root directory and add the following variables:

```
PORT=3000
MONGODB_URI=your_mongodb_uri
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
SESSION_SECRET=your_session_secret

```

4. Run the application:

```
npm start

```

The application will be available at http://localhost:3000.

## Usage

User Side:

    Sign Up or Sign In to your account.
    Browse products and add them to the cart.
    Apply offers and proceed to checkout.
    Select payment method and place the order.
    Track order status and manage returns.

Admin Side:

    Sign In to the admin dashboard.
    Manage products (Add, Edit, Delete).
    View and manage orders.
    Create and manage offers.

## Project Structure

```
zay-ecommerce/
├── public/
│   ├── css/
│   ├── js/
│   └── images/
├── routes/
│   ├── adminRoute.js
│   └── userRoute.js
├── views/
│   ├── admin/
│   ├── partials/
│   ├── user/
│   └── layout
├── .env
├── index.js
├── package.json
└── README.md
```

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes. Ensure your code follows the project's coding standards and includes relevant tests.
