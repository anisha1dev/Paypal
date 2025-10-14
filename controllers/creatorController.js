const Creator = require('../models/Creator');
const fetch = require('node-fetch');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Render login page
exports.renderLogin = (req, res) => {
  res.render('login'); // Make sure you have views/login.ejs
};

// -----------------------
// PayPal OAuth
// -----------------------
exports.startPayPalOAuth = (req, res) => {
  const baseUrl = 'https://www.sandbox.paypal.com/signin/authorize';
  const params = new URLSearchParams({
    client_id: process.env.PAYPAL_APP_CLIENT_ID,
    response_type: 'code', // (this is for requesting an authorization code)
    scope: 'openid profile email https://uri.paypal.com/services/paypalattributes',
    redirect_uri: process.env.PAYPAL_REDIRECT_URI, //(this is the same Return URL)
  });
  res.redirect(`${baseUrl}?${params.toString()}`);
};

// -----------------------
// Handle OAuth Callback
// -----------------------
exports.payPalCallback = async (req, res) => {
  const { code } = req.query; // authorization code that PayPal sends
  if (!code) return res.send('No code received from PayPal');

  try {
    // Exchange code for access token
    const tokenResp = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_APP_CLIENT_ID}:${process.env.PAYPAL_APP_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code }),
    });
    const tokenData = await tokenResp.json();
    console.log("tokenData:",tokenData)
    if (!tokenData.access_token) return res.send('Failed to get PayPal access token');

    // Fetch user info
    const meResp = await fetch('https://api.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const me = await meResp.json();
    if (!me.payer_id) return res.send('PayPal payer_id missing');

    let creator = await Creator.findOne({ email: me.emails[0].value });
    if (creator) {
      // Update tokens
      creator.paypal_access_token = tokenData.access_token; // used to call PayPal APIs
      creator.paypal_refresh_token = tokenData.refresh_token || creator.paypal_refresh_token;
      creator.token_expires_in = tokenData.expires_in || creator.token_expires_in;
      creator.token_created_at = new Date();
      await creator.save();
    } else {
      creator = new Creator({
        name: me.name,
        email: me.emails[0].value, // will be required for payments
        paypal_merchant_id: me.payer_id,
        paypal_access_token: tokenData.access_token,
        token_expires_in: tokenData.expires_in,
        token_created_at: new Date(),
      });
      await creator.save();
    }
    req.session.creatorId = creator._id;
    res.redirect('/creator/create-event');
  } catch (err) {
    console.error(err);
    res.send('PayPal OAuth error');
  }
};

// -----------------------
// Stripe OAuth
// -----------------------
exports.startStripeOAuth = (req, res) => {
  const clientId = process.env.STRIPE_CLIENT_ID;
  const redirectUri = process.env.STRIPE_REDIRECT_URI;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: redirectUri,
  });
  res.redirect(`https://connect.stripe.com/oauth/authorize?${params.toString()}`);
};

exports.stripeCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('No code received from Stripe');

  try {
    const response = await stripe.oauth.token({ grant_type: 'authorization_code', code });
    const stripeUserId = response.stripe_user_id;
    const accessToken = response.access_token;

    const account = await stripe.accounts.retrieve(stripeUserId);
    let creator = await Creator.findOne({ stripe_account_id: stripeUserId });
    if (!creator) {
      creator = new Creator({
        name: account.display_name || account.business_name,
        email: account.email || null,
        stripe_account_id: stripeUserId,
        stripe_access_token: accessToken,
      });
      await creator.save();
    } else {
      creator.stripe_access_token = accessToken;
      await creator.save();
    }

    req.session.creatorId = creator._id;

    // ✅ After Stripe login, redirect to event creation page
    res.redirect('/creator/create-event');

  } catch (err) {
    console.error('❌ Stripe OAuth error:', err);
    res.send('Stripe OAuth error');
  }
};
