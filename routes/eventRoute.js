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
router.post('/capture/:authorizationId', eventController.captureAuthorizedPayment); // Step 3: Capture later (optional)

module.exports = router;
