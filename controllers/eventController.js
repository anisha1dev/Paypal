// controllers/eventController.js
const Event = require('../models/Event');
const Creator = require('../models/Creator');
const paypal = require('@paypal/checkout-server-sdk');

// Helper: create PayPal client
function payPalClient() {
  const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_APP_CLIENT_ID,
    process.env.PAYPAL_APP_SECRET
  );
  return new paypal.core.PayPalHttpClient(environment);
}

// Render create-event page
exports.renderCreateEvent = (req, res) => {
  if (!req.session.creatorId) return res.redirect('/creator/login');
  res.render('create-event');
};

// Create new event
exports.createEvent = async (req, res) => {
  try {
    const { name, description, price, currency } = req.body;
    const creatorId = req.session.creatorId;
    const event = new Event({ name, description, price, currency, creator: creatorId });
    await event.save();
    res.redirect('/events');
  } catch (err) {
    console.error(err);
    res.send('Error creating event');
  }
};

// List all events
exports.listEvents = async (req, res) => {
  try {
    const events = await Event.find().populate('creator');
    res.render('events', { events });
  } catch (err) {
    console.error(err);
    res.send('Error fetching events');
  }
};

// Create PayPal order for an event
exports.payEvent = async (req, res) => {
  try {
    const eventId = req.body.eventId;
    const event = await Event.findById(eventId).populate('creator');
    if (!event) return res.send('Event not found');

    const client = payPalClient();

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: event.currency,
          value: event.price.toString()
        },
        payee: {
          email_address: event.creator.email
        },
        description: event.description
      }],
      application_context: {
        return_url: `${req.protocol}://${req.get('host')}/capture?eventId=${event._id}`,
        cancel_url: `${req.protocol}://${req.get('host')}/events`
      }
    });

    const order = await client.execute(request);
    const approveLink = order.result.links.find(l => l.rel === 'approve').href;
    res.redirect(approveLink);

  } catch (err) {
    console.error(err);
    res.send('Error creating PayPal order');
  }
};

// Capture PayPal order after buyer approval
exports.captureOrder = async (req, res) => {
  try {
    const { token, eventId } = req.query;
    const event = await Event.findById(eventId).populate('creator');

    const client = payPalClient();
    const request = new paypal.orders.OrdersCaptureRequest(token);
    request.requestBody({});
    const capture = await client.execute(request);

    // Extract details for success page
    const payerName = capture.result.payer.name.given_name || 'Customer';
    const payerEmail = capture.result.payer.email_address || 'Not provided';
    const productName = event.name;
    const productPrice = event.price;
    const currency = event.currency;
    const paymentId = capture.result.id;

    res.render('success', { payerName, payerEmail, productName, productPrice, currency, paymentId });

  } catch (err) {
    console.error(err);
    res.send('Error capturing payment');
  }
};

