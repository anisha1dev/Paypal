const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  currency: { type: String, default: 'USD' },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'Creator' },
});

module.exports = mongoose.model('Event', eventSchema);
