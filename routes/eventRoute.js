const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// Creator routes
router.get('/creator/create-event', eventController.renderCreateEvent);
router.post('/creator/create-event', eventController.createEvent);

// Event listing
router.get('/events', eventController.listEvents);

// PayPal routes
router.post('/pay-event', eventController.payEvent);              // Step 1: Create order
router.get('/authorize', eventController.authorizeOrder);         // Step 2: Authorize after approval

// Stripe routes
router.post('/stripe-session', eventController.createStripeSession); // Create checkout session
router.get('/stripe/cancel', (req, res) => res.redirect('/events'));  // Optional cancel handler
router.get('/stripe/success', eventController.stripeSuccess);

module.exports = router;
