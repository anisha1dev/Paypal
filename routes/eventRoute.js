const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

router.get('/creator/create-event', eventController.renderCreateEvent);
router.post('/creator/create-event', eventController.createEvent);

router.get('/events', eventController.listEvents);
router.get('/capture', eventController.captureOrder);
router.post('/pay-event', eventController.payEvent);

module.exports = router;
