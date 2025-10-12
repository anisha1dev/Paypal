// app.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(console.error);

// Middleware
app.use(express.urlencoded({ extended: true })); // only once
app.use(express.json());
app.use(session({ secret: 'paypal-secret', resave: false, saveUninitialized: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Routes
const creatorRoute = require('./routes/creatorRoute');
app.use('/creator', creatorRoute);

const eventRoute = require('./routes/eventRoute');
app.use('/', eventRoute); // mount under /creator

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
