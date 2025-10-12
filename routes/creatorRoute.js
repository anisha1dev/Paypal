const express = require('express');
const router = express.Router();
const creatorController = require('../controllers/creatorController');
const eventController = require('../controllers/eventController'); // import this

// Login / OAuth
router.get('/login', creatorController.renderLogin);
router.get('/oauth', creatorController.startOAuth);
router.get('/callback', creatorController.creatorCallback);

// Create Event page
router.get('/create-event', (req, res) => {
  if (!req.session.creatorId) return res.redirect('/creator/login');
  res.render('create-event');
});

// Handle form submission (POST)
router.post('/create-event', eventController.createEvent);

module.exports = router;
