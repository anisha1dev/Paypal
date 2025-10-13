// controllers/eventController.js
const Event = require('../models/Event');
const paypal = require('@paypal/checkout-server-sdk');

// ---------------------
// Helper: create PayPal client
// ---------------------
function payPalClient() {
  const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_APP_CLIENT_ID,
    process.env.PAYPAL_APP_SECRET
  );
  return new paypal.core.PayPalHttpClient(environment);
}

// ---------------------
// Render create-event page
// ---------------------
exports.renderCreateEvent = (req, res) => {
  if (!req.session.creatorId) return res.redirect('/creator/login');
  res.render('create-event');
};

// ---------------------
// Create new event
// ---------------------
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

// ---------------------
// List all events
// ---------------------
exports.listEvents = async (req, res) => {
  try {
    const events = await Event.find().populate('creator');
    res.render('events', { events });
  } catch (err) {
    console.error(err);
    res.send('Error fetching events');
  }
};

// ---------------------
// Create PayPal order (authorize intent)
// ---------------------
exports.payEvent = async (req, res) => {
  try {
    const eventId = req.body.eventId;
    const event = await Event.findById(eventId).populate('creator');
    if (!event) return res.send('Event not found');

    const client = payPalClient();

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'AUTHORIZE', // ✅ authorize first
      purchase_units: [
        {
          amount: {
            currency_code: event.currency,
            value: event.price.toString(),
          },
          payee: {
            email_address: event.creator.email,
          },
          description: event.description,
        },
      ],
      application_context: {
        brand_name: 'Event Ticketing',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: `${req.protocol}://${req.get('host')}/authorize?eventId=${event._id}`,
        cancel_url: `${req.protocol}://${req.get('host')}/events`,
      },
    });

    const order = await client.execute(request);
    const approveLink = order.result.links.find((l) => l.rel === 'approve').href;
    res.redirect(approveLink);

  } catch (err) {
    console.error(err);
    res.send('Error creating PayPal order');
  }
};

// ---------------------
// Authorize + Auto-Capture Payment
// ---------------------
exports.authorizeOrder = async (req, res) => {
  try {
    const { token, eventId } = req.query;
    const event = await Event.findById(eventId).populate('creator');
    const client = payPalClient();

    // Step 1: Authorize
    const authorizeRequest = new paypal.orders.OrdersAuthorizeRequest(token);
    authorizeRequest.requestBody({});
    const authorization = await client.execute(authorizeRequest);

    const authorizationId =
      authorization.result.purchase_units[0].payments.authorizations[0].id;

    console.log('Authorization ID:', authorizationId);

    // Step 2: Auto-capture
    const captureRequest = new paypal.payments.AuthorizationsCaptureRequest(authorizationId);
    captureRequest.requestBody({});
    const capture = await client.execute(captureRequest);

    console.log('Payment captured:', capture.result);

    // Step 3: Safe extraction
    const payerName =
      authorization.result.payer?.name?.given_name || 'Customer';
    const payerEmail =
      authorization.result.payer?.email_address || 'Not provided';
    const productName = event.name;
    const productPrice = event.price;
    const currency = event.currency;
    const paymentId = capture.result.id;

    // Step 4: Render success page
    res.render('success', {
      payerName,
      payerEmail,
      productName,
      productPrice,
      currency,
      paymentId,
    });
  } catch (err) {
    console.error(err);
    res.send('Error authorizing or capturing payment');
  }
};

// ---------------------
// Capture previously authorized payment (manual trigger)
// ---------------------
exports.captureAuthorizedPayment = async (req, res) => {
  try {
    const { authorizationId } = req.params; // you can send it in the URL
    const client = payPalClient();

    const request = new paypal.payments.AuthorizationsCaptureRequest(authorizationId);
    request.requestBody({});

    const capture = await client.execute(request);
    console.log('Payment captured:', capture.result);
    res.send('Payment captured successfully!');
  } catch (err) {
    console.error(err);
    res.send('Error capturing authorized payment');
  }
};
