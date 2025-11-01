# PayPal + Stripe Integration

---
# PayPal
## 1. Initial Setup of Developer Account

1. Login to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Go to **Apps & Credentials** → Default App → copy **Client ID** and **Secret**

<img width="1123" height="116" alt="Screenshot 2025-11-01 103134" src="https://github.com/user-attachments/assets/eb6e46d8-cdcd-4a94-b542-6d1a59c9b604" />

3. Scroll to **Log in with PayPal** → set **Return URL**

<img width="1131" height="533" alt="2" src="https://github.com/user-attachments/assets/52857222-1d2e-4313-b68e-1c30c7881e59" />

4. Check **Full Name**, **Email**, **Payer ID** to receive info when return URL is invoked.
   Example Return URL:
   `https://unremissive-unfaithfully-laure.ngrok-free.dev/creator/callback`

   > Use HTTPS; localhost URLs won’t save.

<img width="997" height="593" alt="image" src="https://github.com/user-attachments/assets/b99b490d-653b-43a0-a291-e9ccd8afbc1f" />

---

## 2. Event Creator Login (OAuth)

### 2.1 Start OAuth Login

```js
exports.startPayPalOAuth = (req, res) => {
  const baseUrl = 'https://www.sandbox.paypal.com/signin/authorize';
  const params = new URLSearchParams({
    client_id: process.env.PAYPAL_APP_CLIENT_ID,
    response_type: 'code',
    scope: 'openid profile email https://uri.paypal.com/services/paypalattributes',
    redirect_uri: process.env.PAYPAL_REDIRECT_URI,
  });
  res.redirect(`${baseUrl}?${params.toString()}`);
};
```

* Redirects the creator to PayPal login.
* After login, PayPal sends **`code`** to your `redirect_uri`.

---

### 2.2 Handle OAuth Redirect

```js
exports.payPalCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('No code received from PayPal');

  // Exchange code for access token
  const tokenResp = await fetch('https://api.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_APP_CLIENT_ID}:${process.env.PAYPAL_APP_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }),
  });
  const tokenData = await tokenResp.json();
};
```

**Sample Response (tokenData)**

```json
{
  "scope": "https://uri.paypal.com/services/checkout/one-click-with-merchant-issued-token https://uri.paypal.com/services/payments/realtimepayment ...",
  "access_token": "A23AAJsfvs-o_e9ScFKsodwiwy5-zs2r2CWdfaeIYkJX8NdI6sychpOeM3mkcUaVR3NitDmdv8V1xNNtjXDli1bZIJe6sXHDA",
  "token_type": "Bearer",
  "expires_in": 28800,
  "refresh_token": "R23.AAJo-KtbrW4MMDyRrKE8flEjwUYzLGEKKpBM5uJfl4dQBkiv1Yft7LK2fKD3wtBrCOFQlZXoptf4RhYpv0QZ4xRW-i7470Tc5GeYVOMY3z5QZGh3f5yqGm82dqyljkftel4_bAQ_i1lj9gVXpXheHD7D3DM",
  "nonce": "2025-10-14T01:28:52ZhIs_FgJDBBHR1vGtZYMlvV_MtHTplDiPu-SVIqs0nhU"
}
```

---

### 2.3 Fetch Creator Info

```js
const meResp = await fetch('https://api.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1', {
  headers: { Authorization: `Bearer ${tokenData.access_token}` },
});
const me = await meResp.json();
```

**Sample Response**

```json
{
  "user_id": "https://www.paypal.com/webapps/auth/identity/user/3mMO4cX_xapIWjLysOJcsmU9CL6Zh2fGQmX_Avt9u2U",
  "sub": "https://www.paypal.com/webapps/auth/identity/user/3mMO4cX_xapIWjLysOJcsmU9CL6Zh2fGQmX_Avt9u2U",
  "name": "Tim Doe",
  "payer_id": "2JPHCKE993TUY",
  "emails": [
    { "value": "sb-nu55h46212266@business.example.com", "primary": true, "confirmed": true }
  ]
}
```

* Save or update creator in DB with `paypal_access_token`, `paypal_refresh_token`, `paypal_merchant_id`.

---

## 3. Event Ticketing (PayPal Orders)

### 3.1 PayPal Client Helper

```js
function payPalClient() {
  const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_APP_CLIENT_ID,
    process.env.PAYPAL_APP_SECRET
  );
  return new paypal.core.PayPalHttpClient(environment);
}
```

---

### 3.2 Create PayPal Order

```js
exports.payEvent = async (req, res) => {
  const event = await Event.findById(req.body.eventId).populate('creator');
  const client = payPalClient();

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'AUTHORIZE',
    purchase_units: [
      { amount: { currency_code: event.currency, value: event.price.toString() },
        payee: { email_address: event.creator.email },
        description: 'socioplace' }
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
};
```

<img width="1127" height="568" alt="PayPal Sandbox Activities" src="https://github.com/user-attachments/assets/e03a29fb-8ec3-408b-8cb1-23e49064aeec" />

---

### 3.3 Authorize Order (Return URL)

```js
exports.authorizeOrder = async (req, res) => {
  const { token, eventId } = req.query;
  const event = await Event.findById(eventId).populate('creator');
  const client = payPalClient();

  // Authorize
  const authorizeRequest = new paypal.orders.OrdersAuthorizeRequest(token);
  authorizeRequest.requestBody({});
  const authorization = await client.execute(authorizeRequest);

  const authorizationId = authorization.result.purchase_units[0].payments.authorizations[0].id;

  // Capture
  const captureRequest = new paypal.payments.AuthorizationsCaptureRequest(authorizationId);
  captureRequest.requestBody({});
  const capture = await client.execute(captureRequest);

  // Extract safe info
  const payerName = authorization.result.payer?.name?.given_name || 'Customer';
  const payerEmail = authorization.result.payer?.email_address || 'Not provided';
  const productName = event.name;
  const productPrice = event.price;
  const currency = event.currency;
  const paymentId = capture.result.id;

  res.render('success', { payerName, payerEmail, productName, productPrice, currency, paymentId });
};
```

---

## 4. Errors / Notes

* If you see errors like below:

<img width="968" height="465" alt="Error Screenshot" src="https://github.com/user-attachments/assets/dc44f263-b96a-4eaf-aabf-3f3440140e70" />

**Solution**: Update your app secret key.

* **Max Amount**: Verified account → up to $60,000 per transaction (may be limited by PayPal to $10,000)
* **Min Amount**: $0.01
* **Currency Support**: [Multi-currency PayPal support](https://developer.paypal.com/api/nvp-soap/currency-codes/#multi-currency-support-for-paypal-payments)

---

## 5. Quick Commands

```bash
npm i
node app
ngrok http 3000
```

---
# Stripe
## Initial Setup of Developer Account

Details to be taken from [Stripe Dashboard](https://dashboard.stripe.com/):  

```env
STRIPE_SECRET_KEY=sk_**************
STRIPE_PUBLISHABLE_KEY=pk_****************
STRIPE_REDIRECT_URI=https://unremissive-unfaithfully-laure.ngrok-free.dev/creator/stripe/callback
STRIPE_CLIENT_ID=ca_****************
````

<img width="1212" height="396" alt="Stripe Keys" src="https://github.com/user-attachments/assets/0d582624-f90b-4bd4-909c-a51b5fa04617" />

For client ID, go to [Stripe Connect Settings](https://dashboard.stripe.com/settings/connect) → *onboarding options > oauth*. Store the client id in `.env`, enable OAuth, and set your redirect URI.

<img width="1217" height="507" alt="Stripe Connect Settings" src="https://github.com/user-attachments/assets/251d3de6-e118-4b0c-b28c-16787821a9e7" />

---

## Event Creator Login

### Start OAuth Login

Redirect the creator to Stripe’s OAuth page. Once logged in, Stripe redirects back to your redirect URI.

```js
exports.startStripeOAuth = (req, res) => {
  const clientId = process.env.STRIPE_CLIENT_ID;
  const redirectUri = process.env.STRIPE_REDIRECT_URI;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: redirectUri,
  });
  res.redirect(`https://connect.stripe.com/oauth/authorize?${params.toString()}`);
};
```

### Handle OAuth Redirect

1. Stripe redirects back to your return URL with a query parameter `code`.
   Example:
   `https://unremissive-unfaithfully-laure.ngrok-free.dev/creator/stripe/callback?code=ABC123`

2. Exchange the authorization code for an access token:

```js
exports.stripeCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('No code received from Stripe');

  try {
    const response = await stripe.oauth.token({ grant_type: 'authorization_code', code });
    const stripeUserId = response.stripe_user_id;
    const accessToken = response.access_token;

    // Retrieve account info
    const account = await stripe.accounts.retrieve(stripeUserId);
    let creator = await Creator.findOne({ stripe_account_id: stripeUserId });
    if (!creator) {
      creator = new Creator({
        name: account.display_name || account.business_name,
        email: account.email || null,
        stripe_account_id: stripeUserId,
        stripe_access_token: accessToken,
      });
      await creator.save();
    } else {
      creator.stripe_access_token = accessToken;
      await creator.save();
    }

    req.session.creatorId = creator._id;

    // Redirect to event creation page
    res.redirect('/creator/create-event');

  } catch (err) {
    console.error('Stripe OAuth error:', err);
    res.send('Stripe OAuth error');
  }
};
```

---

## Event Ticketing

### Stripe Client Helper

```js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

### Link Stripe to Event Order

```js
exports.createEvent = async (req, res) => {
  try {
    const { name, description, price, currency, paymentMethod } = req.body;
    const creator = await Creator.findById(req.session.creatorId);
    if (!creator) return res.send('Creator not found');

    const event = new Event({
      name,
      description,
      price,
      currency: currency || 'USD',
      creator: creator._id,
      paymentMethod: paymentMethod || 'paypal',
    });

    await event.save();

    console.log("Event created successfully:", {
      id: event._id,
      name: event.name,
      paymentMethod: event.paymentMethod,
      creator: creator.email || creator._id,
    });

    res.redirect('/events');

  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: error.message });
  }
};
```

---

### Stripe Checkout (Customer Payment)

```js
exports.createStripeSession = async (req, res) => {
  try {
    const { eventId } = req.body;
    const event = await Event.findById(eventId).populate('creator');
    if (!event) return res.status(404).send('Event not found');
    if (!event.creator.stripe_account_id) return res.status(400).send('Creator not connected to Stripe');

    const customerEmail = req.session.userEmail || req.session.creatorEmail || 'no-email@example.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: (event.currency || 'USD').toLowerCase(),
          product_data: { name: event.name, description: 'socioplace' },
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
      customer_email: customerEmail,
      success_url: `${req.protocol}://${req.get('host')}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/events`,
    });

    res.redirect(session.url);

  } catch (err) {
    console.error('Stripe Session Error:', err.raw || err);
    res.status(500).send('Stripe session creation error: ' + err.message);
  }
};
```

<img width="1216" height="585" alt="Stripe Checkout 1" src="https://github.com/user-attachments/assets/f8b3d1f4-193f-4b82-a567-c36d34e38158" />
<img width="1213" height="607" alt="Stripe Checkout 2" src="https://github.com/user-attachments/assets/7ceb4ee3-ad50-450f-982c-c30ec1e7ca54" />

**Properties Table**

| Property                    | Purpose                               |
| --------------------------- | ------------------------------------- |
| `payment_method_types`      | Allowed payment methods               |
| `line_items`                | Defines products/services purchased   |
| `customer_email`            | Prefill email in checkout             |
| `currency`                  | Currency for transaction              |
| `product_data.name`         | Name shown in checkout                |
| `unit_amount`               | Amount in smallest currency unit      |
| `quantity`                  | Number of items                       |
| `mode`                      | Payment type (one-time, subscription) |
| `transfer_data.destination` | Sends funds to connected account      |
| `success_url`               | Redirect after successful payment     |
| `cancel_url`                | Redirect if canceled                  |

---

### Stripe Success Page

```js
exports.stripeSuccess = async (req, res) => {
  try {
    const { session_id } = req.query;
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const lineItems = await stripe.checkout.sessions.listLineItems(session_id);
    const item = lineItems.data[0];

    const payerName = session.customer_details?.name || 'Stripe Customer';
    const payerEmail = session.customer_details?.email || 'Not provided';
    const productName = item?.description || 'Event Ticket';
    const productPrice = (item?.amount_total / 100).toFixed(2);
    const currency = session.currency?.toUpperCase() || 'USD';
    const paymentId = session.payment_intent;

    res.render('success', { payerName, payerEmail, productName, productPrice, currency, paymentId });

  } catch (err) {
    console.error("Stripe success error:", err);
    res.status(500).send('Error rendering Stripe success page');
  }
};
```

---

### Testing Payments

Use Stripe test card:

```
Card number: 4242 4242 4242 4242
Expiry: 12/34
CVC: 123
Country: Any
```

---

## Codebase Setup

```bash
npm i
node app
ngrok http 3000
```

[GitHub Repo](https://github.com/anisha1dev/Paypal)

---

## Notes

Only card payment enabled.
[Stripe Payment Methods](https://dashboard.stripe.com/settings/payment_methods/)

<img width="1212" height="602" alt="Stripe Payment Methods" src="https://github.com/user-attachments/assets/a0fde1e5-7017-42f1-b5a4-04575b5e6b3a" />

---

### Maximum Amount

* UK: Max 10 manual payouts/day, £1,000,000 each
* US: Max 10 manual payouts/day, $1,000,000 each
  [Stripe Manual Payouts](https://docs.stripe.com/payouts#manual-payouts)

### Minimum Amount

* See [Stripe Minimum Payout Amounts](https://docs.stripe.com/payouts#minimum-payout-amounts-table)

<img width="1222" height="582" alt="Minimum Payouts" src="https://github.com/user-attachments/assets/a46bb1d1-8f2d-41f6-bcad-d8534ee738ec" />

### Currency Support

[Stripe Presentment Currencies](https://docs.stripe.com/currencies#presentment-currencies)

```
