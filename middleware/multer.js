const multre = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'zay-ecommerce',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multre({ storage: storage });

module.exports = upload;
