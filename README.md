# Paypal integration

# Initial setup of developer account:

1. Login using paypal developer account ([https://developer.paypal.com/dashboard/](https://developer.paypal.com/dashboard/))   
2. Click Apps & Credentials, you will find the default application having *Client ID* and *Secret*

<img width="1123" height="116" alt="Screenshot 2025-11-01 103134" src="https://github.com/user-attachments/assets/eb6e46d8-cdcd-4a94-b542-6d1a59c9b604" />

3. Click the Default application under Apps & Credentials, scroll down to *Log in with PayPal* and set your Return URL. 

<img width="1131" height="533" alt="2" src="https://github.com/user-attachments/assets/52857222-1d2e-4313-b68e-1c30c7881e59" />

4. Check the Full name, email, payer ID to receive information when return url is invoked. I have set Return URL as [https://unremissive-unfaithfully-laure.ngrok-free.dev/creator/callback](https://unremissive-unfaithfully-laure.ngrok-free.dev/creator/callback). Make sure that you set an https link, localhost wont save. NOTE: nativexo://paypalpay is for mobile platforms

<img width="997" height="593" alt="image" src="https://github.com/user-attachments/assets/b99b490d-653b-43a0-a291-e9ccd8afbc1f" />

# Event creator login

### Start OAuth login

To start OAuth login (redirect event-creator to PayPal), you need to set base url as '[https://www.sandbox.paypal.com/signin/authorize](https://www.sandbox.paypal.com/signin/authorize)' with these query params. Once logged into their paypal account they will be redirected to the *redirect_uri.*

// -----------------------  
// PayPal OAuth  
// -----------------------  
exports.startPayPalOAuth = (req, res) => {  
  const baseUrl = 'https://www.sandbox.paypal.com/signin/authorize';  
  const params = new URLSearchParams({  
    client_id: process.env.PAYPAL_APP_CLIENT_ID,  
    response_type: 'code', // (this is for requesting an authorization code)  
    scope: 'openid profile email https://uri.paypal.com/services/paypalattributes',  
    redirect_uri: process.env.PAYPAL_REDIRECT_URI, //(this is the same Return URL)  
  });  
  res.redirect(`${baseUrl}?${params.toString()}`);  
};

### Handle OAuth redirect_uri manually

1. Once the user allows access, PayPal redirects back to your Return URL (set in the app dashboard and in the previous step) with a query parameter code. Example: [https://unremissive-unfaithfully-laure.ngrok-free.dev/creator/callback](https://unremissive-unfaithfully-laure.ngrok-free.dev/creator/callback)[?code=ABC123](https://yourapp.com/creator/callback?code=ABC123)   
2. Need authorization code to get access token. Extracted from query parameter

// -----------------------  
// Handle OAuth Callback  
// -----------------------  
exports.payPalCallback = async (req, res) => {  
  const { code } = req.query; // authorization code that PayPal sends  
  if (!code) return res.send('No code received from PayPal');

3. Exchange code for an access token

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

**Request**  
POST /v1/oauth2/token HTTP/1.1  
Host: [api.sandbox.paypal.com](http://api.sandbox.paypal.com) (live/sandbox environment)  
Headers:  
Authorization: Basic <Base64(client_id:client_secret)>  
Content-Type: application/x-www-form-urlencoded  
Request Body: grant_type=authorization_code&code=<AUTHORIZATION_CODE>

curl -v -X POST https://api.sandbox.paypal.com/v1/oauth2/token \ 
  -H "Authorization: Basic $(echo -n 'YOUR_CLIENT_ID:YOUR_CLIENT_SECRET' | base64)" \ 
  -H "Content-Type: application/x-www-form-urlencoded" \ 
  -d "grant_type=authorization_code&code=RECEIVED_AUTH_CODE"  
**Sample Response**  
{  
  scope: 'https://uri.paypal.com/services/checkout/one-click-with-merchant-issued-token https://uri.paypal.com/services/payments/realtimepayment https://uri.paypal.com/services/payments/payment/authcapture openid profile https://uri.paypal.com/services/subscriptions/confirm-payment https://uri.paypal.com/services/payments/refund https://uri.paypal.com/services/payments/orders/client_sdk_orders_api https://uri.paypal.com/services/payments/client-payments-eligibility https://uri.paypal.com/services/documents/disputes/download https://api.paypal.com/v1/vault/credit-card https://uri.paypal.com/services/pricing/quote-exchange-rates/read https://api.paypal.com/v1/vault/credit-card/.*
https://uri.paypal.com/services/applications/webhooks https://uri.paypal.com/services/paypalattributes email https://uri.paypal.com/services/credit/client-offer-presentment/read https://uri.paypal.com/services/pricing/exchange-currency/read',  
  access_token: 'A23AAJsfvs-o_e9ScFKsodwiwy5-zs2r2CWdfaeIYkJX8NdI6sychpOeM3mkcUaVR3NitDmdv8V1xNNtjXDli1bZIJe6sXHDA',  
  token_type: 'Bearer',  
  expires_in: 28800,  
  refresh_token: 'R23.AAJo-KtbrW4MMDyRrKE8flEjwUYzLGEKKpBM5uJfl4dQBkiv1Yft7LK2fKD3wtBrCOFQlZXoptf4RhYpv0QZ4xRW-i7470Tc5GeYVOMY3z5QZGh3f5yqGm82dqyljkftel4_bAQ_i1lj9gVXpXheHD7D3DM',  
  nonce: '2025-10-14T01:28:52ZhIs_FgJDBBHR1vGtZYMlvV_MtHTplDiPu-SVIqs0nhU'  
}

4. Fetch event-creator info from PayPal by passing in access_token headers to [https://api.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1](https://api.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1)

if (!tokenData.access_token) return res.send('Failed to get PayPal access token');

// Fetch user info  
const meResp = await fetch('https://api.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1', {  
  headers: { Authorization: `Bearer ${tokenData.access_token}` },  
});  
const me = await meResp.json();

**Request**  
GET /v1/identity/oauth2/userinfo?schema=paypalv1.1 HTTP/1.1  
Host: api.sandbox.paypal.com  
Headers:  
Authorization: Bearer <ACCESS_TOKEN>

curl -v -X GET "https://api.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1" \ 
  -H "Authorization: Bearer A23AAJsfvs-o_e9ScFKsodwiwy5-zs2r2CWdfaeIYkJX8NdI6sychpOeM3mkcUaVR3NitDmdv8V1xNNtjXDli1bZIJe6sXHDA"

**Sample Response**  
{  
  user_id: 'https://www.paypal.com/webapps/auth/identity/user/3mMO4cX_xapIWjLysOJcsmU9CL6Zh2fGQmX_Avt9u2U',  
  sub: 'https://www.paypal.com/webapps/auth/identity/user/3mMO4cX_xapIWjLysOJcsmU9CL6Zh2fGQmX_Avt9u2U',  
  name: 'Tim Doe',  
 payer_id: '2JPHCKE993TUY',  
  emails: [  
    {  
      value: 'sb-nu55h46212266@business.example.com',  
      primary: true,  
      confirmed: true  
    }  
  ]  
}

5. Save or update event-creator in your database

if (!me.payer_id) return res.send('PayPal payer_id missing');

let creator = await Creator.findOne({ email: me.emails[0].value });  
if (creator) {  
  // Update tokens  
  creator.paypal_access_token = tokenData.access_token; // used to call PayPal APIs  
  creator.paypal_refresh_token = tokenData.refresh_token || creator.paypal_refresh_token;  
  creator.token_expires_in = tokenData.expires_in || creator.token_expires_in;  
  creator.token_created_at = new Date();  
  await creator.save();  
} else {  
  creator = new Creator({  
    name: me.name,          
    email: me.emails[0].value, // will be required for payments  
    paypal_merchant_id: me.payer_id,  
    paypal_access_token: tokenData.access_token,  
    token_expires_in: tokenData.expires_in,  
    token_created_at: new Date(),  
  });  
  await creator.save();  
}

6. Now event-creator can create events. 

# Event Ticketing

### PayPal Client Helper

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

1. Creates a PayPal SDK client for sandbox testing.  
2. Uses your app credentials to communicate with PayPal APIs.  
3. Switch SandboxEnvironment → LiveEnvironment for production.  
   

### Link PayPal to Event-order

Adding price tag for the event ticket.

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
          description: 'socioplace',  
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

[https://www.sandbox.paypal.com/myaccount/activities/](https://www.sandbox.paypal.com/myaccount/activities/)   
<img width="1127" height="568" alt="image" src="https://github.com/user-attachments/assets/e03a29fb-8ec3-408b-8cb1-23e49064aeec" />

**Request**  
POST  
SDK: paypal.orders.OrdersCreateRequest()  
Headers:  
Prefer: return=representation

Request Body:   
{  
  "intent": "AUTHORIZE",  
  "purchase_units": [  
    {  
      "amount": {  
        "currency_code": "USD",  
        "value": "50.00"  
      },  
      "payee": {  
        "email_address": "creator@example.com"  
      },  
      "description": "socioplace"  
    }  
  ],  
  "application_context": {  
    "brand_name": "Event Ticketing",  
    "landing_page": "LOGIN",  
    "user_action": "PAY_NOW",  
    "return_url": "https://yourdomain.com/authorize?eventId=12345",  
    "cancel_url": "https://yourdomain.com/events"  
  }  
}

### Payment

This route will be invoked as a result of the "return_url" set in paypal.orders.OrdersCreateRequest().

Step 1: Setup payPalClient() and event

exports.authorizeOrder = async (req, res) => {  
  try {  
    const { token, eventId } = req.query;      
    const event = await Event.findById(eventId).populate('creator'); //from DB  
    const client = payPalClient();

Step 2: Authorize request

    // Step 1: Authorize  
    const authorizeRequest = new paypal.orders.OrdersAuthorizeRequest(token);  
    authorizeRequest.requestBody({});  
    const authorization = await client.execute(authorizeRequest);

    const authorizationId =  
      authorization.result.purchase_units[0].payments.authorizations[0].id;

**Request**  
POST  
SDK: paypal.orders.OrdersAuthorizeRequest(token)   
Request body: {}

**Sample Response**  
{  
  "statusCode": 201,  
  "headers": {  
    "content-type": "application/json",  
    "content-length": "1777",  
    "connection": "keep-alive",  
    "date": "Tue, 14 Oct 2025 02:04:41 GMT",  
    "access-control-expose-headers": "Server-Timing",  
    "application_id": "APP-06883287TB927123K",  
    "cache-control": "max-age=0, no-cache, no-store, must-revalidate",  
    "caller_acct_num": "HDT6UZDGJL2PW",  
    "paypal-debug-id": "a278e0a3a1b66",  
    "server-timing": "traceparent;desc=\\"00-0000000000000000000a278e0a3a1b66-e614e10913509fb6-01\\"",  
    "vary": "Accept-Encoding",  
    "http_x_pp_az_locator": "ccg18.slc",  
    "strict-transport-security": "max-age=31536000; includeSubDomains"  
  },  
  "result": {  
    "id": "3T746374X27109942",  
    "status": "COMPLETED",  
    "payment_source": {  
      "paypal": {  
        "email_address": "sb-imqmm46848439@personal.example.com",  
        "account_id": "ZUFQ88XFBHLRQ",  
        "account_status": "VERIFIED",  
        "name": {  
          "given_name": "Ani",  
          "surname": "Shaw"  
        },  
        "address": {  
          "country_code": "AE"  
        }  
      }  
    },  
    "purchase_units": [  
      {  
        "reference_id": "default",  
        "shipping": {  
          "name": {  
            "full_name": "Ani Shaw"  
          },  
          "address": {  
            "address_line_1": "1 Main St",  
            "admin_area_2": "San JosetestaccountraptorservService/pom.xml",  
            "admin_area_1": "CA",  
            "postal_code": "95131",  
            "country_code": "AE"  
          }  
        },  
        "payments": {  
          "authorizations": [  
            {  
              "status": "CREATED",  
              "id": "522374738M957334X",  
              "amount": {  
                "currency_code": "USD",  
                "value": "10.50"  
              },  
              "seller_protection": {  
                "status": "ELIGIBLE",  
                "dispute_categories": [  
                  "ITEM_NOT_RECEIVED",  
                  "UNAUTHORIZED_TRANSACTION"  
                ]  
              },  
              "expiration_time": "2025-11-12T02:04:41Z",  
              "links": [  
                {  
                  "href": "https://api.sandbox.paypal.com/v2/payments/authorizations/522374738M957334X",  
                  "rel": "self",  
                  "method": "GET"  
                },  
                {  
                  "href": "https://api.sandbox.paypal.com/v2/payments/authorizations/522374738M957334X/capture",  
                  "rel": "capture",  
                  "method": "POST"  
                },  
                {  
                  "href": "https://api.sandbox.paypal.com/v2/payments/authorizations/522374738M957334X/void",  
                  "rel": "void",  
                  "method": "POST"  
                },  
                {  
                  "href": "https://api.sandbox.paypal.com/v2/payments/authorizations/522374738M957334X/reauthorize",  
                  "rel": "reauthorize",  
                  "method": "POST"  
                },  
                {  
                  "href": "https://api.sandbox.paypal.com/v2/checkout/orders/3T746374X27109942",  
                  "rel": "up",  
                  "method": "GET"  
                }  
              ],  
              "create_time": "2025-10-14T02:04:41Z",  
              "update_time": "2025-10-14T02:04:41Z"  
            }  
          ]  
        }  
      }  
    ],  
    "payer": {  
      "name": {  
        "given_name": "Ani",  
        "surname": "Shaw"  
      },  
      "email_address": "sb-imqmm46848439@personal.example.com",  
      "payer_id": "ZUFQ88XFBHLRQ",  
      "address": {  
        "country_code": "AE"  
      }  
    },  
    "links": [  
      {  
        "href": "https://api.sandbox.paypal.com/v2/checkout/orders/3T746374X27109942",  
        "rel": "self",  
        "method": "GET"  
      }  
    ]  
  }  
}

Step 3: Authorize the capture request  
Funds are now debited from the payer and sent to creator.

    // Step 2: Authorize-capture  
    const captureRequest = new paypal.payments.AuthorizationsCaptureRequest(authorizationId);  
    captureRequest.requestBody({});  
    const capture = await client.execute(captureRequest);

**Request**

POST   
SDK: paypal.payments.AuthorizationsCaptureRequest(authorizationId);  
Request body: {}

**Sample Response**

{  
  "statusCode": 201,  
  "headers": {  
    "content-type": "application/json;charset=UTF-8",  
    "content-length": "398",  
    "connection": "keep-alive",  
    "date": "Tue, 14 Oct 2025 02:07:35 GMT",  
    "access-control-expose-headers": "Server-Timing",  
    "application_id": "APP-06883287TB927123K",  
    "cache-control": "max-age=0, no-cache, no-store, must-revalidate",  
    "caller_acct_num": "HDT6UZDGJL2PW",  
    "paypal-debug-id": "78abb4493137c",  
    "server-timing": "traceparent;desc=\\"00-000000000000000000078abb4493137c-04160e11ee627037-01\\"",  
    "vary": "Accept-Encoding",  
    "http_x_pp_az_locator": "ccg18.slc",  
    "strict-transport-security": "max-age=31536000; includeSubDomains"  
  },  
  "result": {  
    "id": "97N47046L83828351",  
    "status": "COMPLETED",  
    "links": [  
      {  
        "href": "https://api.sandbox.paypal.com/v2/payments/captures/97N47046L83828351",  
        "rel": "self",  
        "method": "GET"  
      },  
      {  
        "href": "https://api.sandbox.paypal.com/v2/payments/captures/97N47046L83828351/refund",  
        "rel": "refund",  
        "method": "POST"  
      },  
      {  
        "href": "https://api.sandbox.paypal.com/v2/payments/authorizations/8A834264N99766824",  
        "rel": "up",  
        "method": "GET"  
      }  
    ]  
  }  
}

Step 4: Extract details safely  
Payer name, email, product name, price, currency, and payment ID.

    // Step 3: Safe extraction  
    const payerName =  
      authorization.result.payer?.name?.given_name || 'Customer';  
    const payerEmail =  
      authorization.result.payer?.email_address || 'Not provided';  
    const productName = event.name;  
    const productPrice = event.price;  
    const currency = event.currency;  
    const paymentId = capture.result.id;

Step 4: Render success page  
Shows a confirmation page with all payment details.

    // Step 4: Render success page  
    res.render('success', {  
      payerName,  
      payerEmail,  
      productName,  
      productPrice,  
      currency,  
      paymentId,  
    });

# CODEBASE

1. npm i  
2. node app  
3. ngrok http 3000

[https://github.com/anisha1dev/Paypal](https://github.com/anisha1dev/Paypal) 

# ERRORS

<img width="968" height="465" alt="image" src="https://github.com/user-attachments/assets/dc44f263-b96a-4eaf-aabf-3f3440140e70" />

Solution: Change your application’s secret key

# 

# NOTES

## What is the maximum amount I can send from my PayPal account?

[Paypal cap limit](https://www.paypal.com/ae/cshelp/article/%D9%85%D8%A7-%D9%87%D9%88-%D8%A3%D9%82%D8%B5%D9%89-%D9%85%D8%A8%D9%84%D8%BA-%D9%8A%D9%85%D9%83%D9%86%D9%86%D9%8A-%D8%A5%D8%B1%D8%B3%D8%A7%D9%84%D9%87-%D9%85%D9%86-%D8%AD%D8%B3%D8%A7%D8%A8%D9%8A-%D8%B9%D9%84%D9%89-paypal%E2%80%8F%D8%9F-help286) 

If you have a verified PayPal account, there is no maximum amount you can send. You can send up to $60,000.00 in a single transaction, but we may limit this amount to $10,000.00. These amounts may also vary based on your currency.

If you haven't verified your PayPal account, there's a limit to the total amount you can send. You can review this amount when you want to send payments.

## What is the minimum amount I can send from my PayPal account?

PayPal accounts have a minimum transaction amount of $0.01

## Currency support

[https://developer.paypal.com/api/nvp-soap/currency-codes/\#multi-currency-support-for-paypal-payments](https://developer.paypal.com/api/nvp-soap/currency-codes/#multi-currency-support-for-paypal-payments) 
