// controllers/eventController.js
const Event = require('../models/Event');
const paypal = require('@paypal/checkout-server-sdk');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const Creator = require('../models/Creator');

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
    console.log("🎯 Incoming event data:", req.body);

    const { name, description, price, currency, creatorId, paymentMethod } = req.body;

    // 1️⃣ Validate the creator exists
    const creator = await Creator.findById(req.session.creatorId);
    if (!creator) {
      console.warn('⚠️ Creator not found:', req.session.creatorId);
      return res.send('Creator not found');
    }


    // 2️⃣ Create event
    const event = new Event({
      name,
      description,
      price,
      currency: currency || 'USD',
      creator: creator._id,
      paymentMethod: paymentMethod || 'paypal',
    });

    // 3️⃣ Save
    await event.save();

    console.log("✅ Event created successfully:", {
      id: event._id,
      name: event.name,
      paymentMethod: event.paymentMethod,
      creator: creator.email || creator._id,
    });
    
    res.redirect('/events');

  } catch (error) {
    console.error("❌ Error creating event:", error);
    res.status(500).json({ error: error.message });
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
    const event = await Event.findById(eventId).populate('creator'); //DB search
    if (!event) return res.send('Event not found');

    const client = payPalClient();

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    // This tells PayPal: When responding, return the full representation 
    // of the resource I just created instead of minimal info.
    // This way you get a full object with Purchase units, 
    // Amount, Currency, Payer info, Links.
    request.requestBody({
      intent: 'AUTHORIZE', // authorize first
      purchase_units: [
        {
          amount: {
            currency_code: event.currency,
            value: event.price.toString(),
          },
          payee: {
            email_address: event.creator.email, // Event creator's email
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
// Authorize Payment
// ---------------------
exports.authorizeOrder = async (req, res) => {
  try {
    const { token, eventId } = req.query;
    const event = await Event.findById(eventId).populate('creator'); //from DB
    const client = payPalClient();

    // Step 1: Authorize
    const authorizeRequest = new paypal.orders.OrdersAuthorizeRequest(token);
    authorizeRequest.requestBody({});
    const authorization = await client.execute(authorizeRequest);

    const authorizationId =
      authorization.result.purchase_units[0].payments.authorizations[0].id;

    console.log(JSON.stringify(authorization, null, 2));


    // Step 2: Auto-capture
    const captureRequest = new paypal.payments.AuthorizationsCaptureRequest(authorizationId);
    captureRequest.requestBody({});
    const capture = await client.execute(captureRequest);
    console.log(JSON.stringify(capture, null, 2));

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


exports.createStripeSession = async (req, res) => {
  try {
    const { eventId } = req.body;
    const event = await Event.findById(eventId).populate('creator');
    if (!event) return res.status(404).send('Event not found');
    if (!event.creator.stripe_account_id) return res.status(400).send('Creator not connected to Stripe');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: (event.currency || 'USD').toLowerCase(),
          product_data: { name: event.name },
          unit_amount: Math.round(event.price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      payment_intent_data: {
        transfer_data: {
          destination: event.creator.stripe_account_id,
        },
      },
      success_url: `${req.protocol}://${req.get('host')}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/events`,
    });


    res.redirect(session.url);

  } catch (err) {
    console.error('Stripe Session Error:', err.raw || err);
    res.status(500).send('Stripe session creation error: ' + err.message);
  }
};

exports.stripeSuccess = async (req, res) => {
  try {
    const { session_id } = req.query;
    console.log("🔹 Stripe Success: Received session_id =", session_id);

    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("✅ Stripe Session Retrieved:", session);

    const lineItems = await stripe.checkout.sessions.listLineItems(session_id);
    const item = lineItems.data[0];
    console.log("✅ Stripe Line Items:", item);

    const payerName = session.customer_details?.name || 'Stripe Customer';
    const payerEmail = session.customer_details?.email || 'Not provided';
    const productName = item?.description || 'Event Ticket';
    const productPrice = (item?.amount_total / 100).toFixed(2);
    const currency = session.currency?.toUpperCase() || 'USD';
    const paymentId = session.payment_intent;

    console.log("✅ Stripe Payment Summary:", {
      payerName,
      payerEmail,
      productName,
      productPrice,
      currency,
      paymentId,
    });

    res.render('success', {
      payerName,
      payerEmail,
      productName,
      productPrice,
      currency,
      paymentId,
    });
  } catch (err) {
    console.error("❌ Stripe success error:", err);
    res.status(500).send('Error rendering Stripe success page');
  }
};

