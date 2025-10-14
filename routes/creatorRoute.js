const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creatorController');

// Login / OAuth
router.get('/login', creatorController.renderLogin);
router.get('/paypal-oauth', creatorController.startPayPalOAuth);
router.get('/callback', creatorController.payPalCallback);
router.get('/stripe-oauth', creatorController.startStripeOAuth);
router.get('/stripe/callback', creatorController.stripeCallback);

// Create Event
router.get('/create-event', (req, res) => {
  if (!req.session.creatorId) return res.redirect('/creator/login');
  res.render('create-event');
});
router.post('/create-event', require('../controllers/eventController').createEvent);

module.exports = router;
