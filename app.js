const express = require('express');
require("dotenv").config();

const app = express();
var http = require('http').Server(app);

// ✅ add this line to serve CSS
app.use(express.static('public'));

const paymentRoute = require('./routes/paymentRoute');
app.use('/', paymentRoute);

http.listen(3000, function(){
    console.log('Server is running at http://localhost:3000');
});
