// models/Event.js
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  currency: String,
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'Creator' },
  paymentMethod: { type: String, enum: ['paypal', 'stripe'], default: 'paypal' }, // new
});

module.exports = mongoose.model('Event', eventSchema);
