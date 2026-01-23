import mongoose from 'mongoose';

const cetagory = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  isListed: {
    type: Boolean,
  },
});

export default mongoose.model('cetagory', cetagory);
