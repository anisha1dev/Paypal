const mongoose = require('mongoose');

const creatorSchema = new mongoose.Schema({
  name: { type: String, required: false },
  email: { type: String, required: false, unique: true, sparse: true },
  paypal_merchant_id: { type: String, required: false }, // <- change required to false
  paypal_access_token: String,
  paypal_refresh_token: String,
  stripe_account_id: String,
  stripe_access_token: String,
  token_expires_in: Number,
  token_created_at: Date
});

module.exports = mongoose.model('Creator', creatorSchema);
