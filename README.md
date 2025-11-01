# PayPal Integration

---

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
