# Paypal integration

# Event creator logs in

### // Start OAuth login (redirect user to PayPal)

1. Login using paypal developer account ([https://developer.paypal.com/dashboard/](https://developer.paypal.com/dashboard/))   
2. Click Apps & Credentials, you will find the default application having *Client ID* and *Secret*  
3. Click the Default application under Apps & Credentials, scroll down to *Log in with PayPal* and set your Return URL. Check the Full name, email, payer ID to receive information when return url is invoked. I have set Return URL as [https://unremissive-unfaithfully-laure.ngrok-free.dev/creator/callback](https://unremissive-unfaithfully-laure.ngrok-free.dev/creator/callback). Make sure that you set an https link, localhost wont save.  
4. To start OAuth login (redirect event-creator to PayPal), you need to set base url as '[https://www.sandbox.paypal.com/signin/authorize](https://www.sandbox.paypal.com/signin/authorize)' with these query params:  
   1. client\_id: PAYPAL\_APP\_CLIENT\_ID, (this is your Client ID)  
      2. response\_type: 'code', (this is for requesting an authorization code)  
      3. scope: 'openid profile email https://uri.paypal.com/services/paypalattributes',  
      4. redirect\_uri: PAYPAL\_REDIRECT\_URI (this is the same Return URL)

### // Handle OAuth callback manually

1. Once the user allows access, PayPal redirects back to your Return URL (set in the app dashboard) with a query parameter code. Example: [https://yourapp.com/creator/callback?code=ABC123](https://yourapp.com/creator/callback?code=ABC123)   
2. Receive the authorization code from the query param  
   1. *code* is the authorization code that PayPal sends.  
   2. If it’s missing, the process stops because you cannot get an access token without it.  
3. Exchange code for an access token  
   1. POST the body with grant\_type, code and Content-Type as *'application/x-www-form-urlencoded'* to [https://api.sandbox.paypal.com/v1/oauth2/token](https://api.sandbox.paypal.com/v1/oauth2/token)   
      1. ‘grant\_type’: ‘authorization\_code’ → tells PayPal you’re using the Authorization Code flow.  
      2. ‘Authorization’: \` Basic (Client ID:Secret).toBase64()\`  
      3. const tokenData \= await tokenResp.json();  
      4. Result: tokenData will contain:  
         1. access\_token → used to call PayPal APIs  
         2. refresh\_token → optional, to refresh the access token later  
         3. expires\_in → token lifetime  
   2. Fetch event-creator info from PayPal by passing in headers to [https://api.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1](https://api.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1) :  
      1. 'Authorization': \`Bearer ${tokenData.access\_token}\`  
4. Save or update event-creator in your database  
   1. const me \= await meResp.json();  
      1. name: me.name,  
      2. email: me.emails\[0\].value,  
      3. paypal\_merchant\_id: me.payer\_id,  
      4. access\_token: tokenData.access\_token,  
      5. token\_expires\_in: tokenData.expires\_in,  
      6. token\_created\_at: new Date(),  
5. Now event-creator can create events and charge for it.

# Event Ticketing \+ PayPal Integration

1. ### PayPal Client Helper

   function payPalClient() {  
     const environment \= new paypal.core.SandboxEnvironment(  
       process.env.PAYPAL\_APP\_CLIENT\_ID,  
       process.env.PAYPAL\_APP\_SECRET  
     );  
     return new paypal.core.PayPalHttpClient(environment);  
   }  
1. Creates a PayPal SDK client for sandbox testing.  
2. Uses your app credentials to communicate with PayPal APIs.  
3. Switch SandboxEnvironment → LiveEnvironment for production.  
   

2. ### Create PayPal Order (Authorize Intent) \[TO BE LINKED TO EVENT\]

   1. exports.payEvent \= async (req, res) \=\> { ... }  
1. Finds the event and its creator.  
2. Uses PayPal SDK to create an order with AUTHORIZE intent:  
   1. intent: 'AUTHORIZE' → only authorize first; capture later.  
   2. purchase\_units.payee.email\_address → funds go to event creator.  
3. Sets return\_url and cancel\_url for PayPal flow. (This would auto redirect the user from paypal payment page if he cancels or successfully pays. NOTE: The return\_url here is different from the callback url we have set in the application.)  
4. Redirects the user to PayPal approval page.

3. ### Authorize \+ Auto-Capture Payment \[LINKED WITH THE RETURN\_URL SET WHILE CREATING EVENT-PAY-ORDER\]

   1. exports.authorizeOrder \= async (req, res) \=\> { ... }  
      1. Step 1: Authorize payment  
         1. Receives token from PayPal after approval as a query param along with eventId.  
            1. NOTE on eventId  
               1. The eventId comes from where the user initiates the payment—it’s essentially the ID of the event they want to buy a ticket for.  
                  1. eventId is read from the Event-book-now form submitted by the user (POST request).  
                  2. It must match the \_id of the event in your MongoDB Event collection.  
                  3. How it flows to authorizeOrder  
                     1. return\_url: \`${req.protocol}://${req.get('host')}/authorize?eventId=${event.\_id}\`  
                        1. When creating the PayPal order, you include the eventId in the return URL as a query parameter.  
                        2. After the user approves the payment, PayPal redirects them back with token (authorization token) and your eventId query parameter.  
                        3. This lets your authorizeOrder route know which event the payment is for.  
            2. Calls OrdersAuthorizeRequest(token) → creates an authorization.  
               1. const authorizeRequest \= new paypal.orders.OrdersAuthorizeRequest(token);  
               2. const authorization \= await client.execute(authorizeRequest);  
      2. Step 2: Auto-capture  
         1. Extract authorizationId → call   
            1. const authorizationId \= authorization.result.purchase\_units\[0\].payments.authorizations\[0\].id;  
         2. const captureRequest \= new paypal.payments.AuthorizationsCaptureRequest(authorizationId);  
         3. const capture \= await client.execute(captureRequest);  
         4. const paymentId \= capture.result.id;  
         5. Funds are now captured from the payer and sent to the creator.  
      3. Step 3: Extract details safely  
         1. Payer name, email, product name, price, currency, and payment ID.  
            1. const payerName \=  
            2. authorization.result.payer?.name?.given\_name || 'Customer';  
            3. const payerEmail \=  
            4. authorization.result.payer?.email\_address || 'Not provided';  
            5. const productName \= event.name;  
            6. const productPrice \= event.price;  
            7. const currency \= event.currency;  
            8. const paymentId \= capture.result.id;  
      4. Step 4: Render success page  
         1. Shows a confirmation page with all payment details.

4. ### If you want to later on \[Capture Previously Authorized Payment (Manual Trigger)\]

   1. exports.captureAuthorizedPayment \= async (req, res) \=\> { ... }  
      1. Can be called manually with an authorizationId.  
      2. Useful for delayed capture scenarios or if you want to control capture timing.  
         1. const { authorizationId } \= req.params; // you can send it in the URL  
         2. const client \= payPalClient();  
         3. const request \= new paypal.payments.AuthorizationsCaptureRequest(authorizationId);  
         4. const capture \= await client.execute(request);

