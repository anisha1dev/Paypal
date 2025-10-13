// controllers/creatorController.js
const Creator = require('../models/Creator');
const { Client, Environment } = require('@paypal/paypal-server-sdk');

// Render login page
exports.renderLogin = (req, res) => {
  res.render('login');
};

// Start OAuth login (redirect user to PayPal)
exports.startOAuth = (req, res) => {
  const baseUrl = 'https://www.sandbox.paypal.com/signin/authorize';
  const params = new URLSearchParams({
    client_id: process.env.PAYPAL_APP_CLIENT_ID,
    response_type: 'code',
    scope: 'openid profile email https://uri.paypal.com/services/paypalattributes',
    redirect_uri: process.env.PAYPAL_REDIRECT_URI
  });

  res.redirect(`${baseUrl}?${params.toString()}`);
};

// Handle OAuth callback manually
exports.creatorCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('No code received');

  try {
    // --- Exchange code for access token ---
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);

    const tokenResp = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${process.env.PAYPAL_APP_CLIENT_ID}:${process.env.PAYPAL_APP_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });

    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) return res.send('Failed to get access token');

    // --- Fetch merchant info from PayPal (this is key for payer_id) ---
    const meResp = await fetch('https://api.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    const me = await meResp.json();
    console.log(me); // after fetching user info

    if (!me.payer_id) return res.send('Error: payer_id missing in PayPal response');
    const existingCreator = await Creator.findOne({ email: me.emails[0].value });

    if (existingCreator) {
    // Update access token if already exists
    existingCreator.access_token = tokenData.access_token;
    existingCreator.refresh_token = tokenData.refresh_token || existingCreator.refresh_token;
    existingCreator.token_expires_in = tokenData.expires_in || existingCreator.token_expires_in;
    existingCreator.token_created_at = new Date();
    await existingCreator.save();

    req.session.creatorId = existingCreator._id;
    } else {
    // Create new creator
    const creator = new Creator({
        name: me.name,
        email: me.emails[0].value,
        paypal_merchant_id: me.payer_id,
        access_token: tokenData.access_token,
        token_expires_in: tokenData.expires_in,
        token_created_at: new Date(),
    });
    await creator.save();
    req.session.creatorId = creator._id;
    }

    // Redirect in both cases
    // After saving or updating creator in DB
    res.redirect('/creator/create-event');

  } catch (err) {
    console.error(err);
    res.send('Error during PayPal OAuth');
  }
};
