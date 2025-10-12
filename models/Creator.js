const mongoose = require('mongoose');

const creatorSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: false },
  paypal_merchant_id: { type: String, required: true },
  access_token: String,
  refresh_token: String,
  token_expires_in: Number,
  token_created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Creator', creatorSchema);
