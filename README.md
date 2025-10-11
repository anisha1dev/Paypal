![PayPal Order Flow](https://www.paypalobjects.com/ppdevdocs/orders-api/orders-api-standard-flow.png)
---

## Step 1: Get `access_token`
Request an OAuth2 token using:

```

POST /v1/oauth2/token

```

This `access_token` will be used to authorize subsequent API calls.

## Step 2: Create an Order
Use the `access_token` to create an order:

```

POST /v2/checkout/orders

```

Example response includes an order ID:

```

id: 5PA06018TW008943K

```

## Step 3: Check Order Status
Check the status of an order by passing the ID received in Step 2:

```

GET /v2/checkout/orders/{id}

```

Replace `{id}` with the order ID.

## Step 4: Capture Payment
Capture payment for an order:

```

POST /v2/checkout/orders/{id}/capture

```

> **Note:** To successfully capture payment, the buyer must first approve the order or a valid `payment_source` must be provided in the request.

## References
- [Get Access Token](https://developer.paypal.com/api/rest/#link-getaccesstoken)  
- [Create Order](https://developer.paypal.com/docs/api/orders/v2/#orders_create)  
- [Get Order](https://developer.paypal.com/docs/api/orders/v2/#orders_get)  
- [Capture Order](https://developer.paypal.com/docs/api/orders/v2/#orders_capture)
# PayPal OAuth2 Token Request
## cURL Command

```bash
curl -v -X POST "https://api-m.sandbox.paypal.com/v1/oauth2/token" \
 -u "CLIENT_ID:CLIENT_SECRET" \
 -H "Content-Type: application/x-www-form-urlencoded" \
 -d "grant_type=client_credentials"
````

### Instructions

1. **Modify the code**

   * Replace `CLIENT_ID` with your PayPal client ID.
   * Replace `CLIENT_SECRET` with your PayPal client secret.


## Sample Response

PayPal will return an access token along with its expiration time:

```json
{
  "scope": "https://uri.paypal.com/services/invoicing https://uri.paypal.com/services/disputes/read-buyer https://uri.paypal.com/services/payments/realtimepayment https://uri.paypal.com/services/disputes/update-seller https://uri.paypal.com/services/payments/payment/authcapture openid https://uri.paypal.com/services/disputes/read-seller https://uri.paypal.com/services/payments/refund https://api-m.paypal.com/v1/vault/credit-card https://api-m.paypal.com/v1/payments/.* https://uri.paypal.com/payments/payouts https://api-m.paypal.com/v1/vault/credit-card/.* https://uri.paypal.com/services/subscriptions https://uri.paypal.com/services/applications/webhooks",
  "access_token": "A21AAFEpH4PsADK7qSS7pSRsgzfENtu-Q1ysgEDVDESseMHBYXVJYE8ovjj68elIDy8nF26AwPhfXTIeWAZHSLIsQkSYz9ifg",
  "token_type": "Bearer",
  "app_id": "APP-80W284485P519543T",
  "expires_in": 31668,
  "nonce": "2020-04-03T15:35:36ZaYZlGvEkV4yVSz8g6bAKFoGSEzuy3CQcz3ljhibkOHg"
}
```
---
# PayPal Orders API – Create Order

## Endpoint

```
POST /v2/checkout/orders
```

Creates an order. Merchants and partners can add Level 2 and 3 data to payments to reduce risk and processing costs.

---

## Security

* OAuth2 access token required in the `Authorization` header. Return / Cancel url can be customized.
* `PayPal-Request-Id`: string (1–108 chars) — idempotency key; stores keys for 6 hours (up to 72 hours on request). **Mandatory** for single-step create order calls with payment source.
  
Optional headers:
* `PayPal-Partner-Attribution-Id`: string (1–36 chars)
* `PayPal-Client-Metadata-Id`: string (1–36 chars)
* `Prefer`: string (1–25 chars) — default: `return=minimal`

  * `return=minimal`: returns id, status, and HATEOAS links (default)
  * `return=representation`: returns full resource representation
* `PayPal-Auth-Assertion`: JSON Web Token (JWT) identifying the merchant

---

## Request Body

```json
{
  "intent": "CAPTURE",
  "purchase_units": [
    {
      "amount": {
        "currency_code": "USD",
        "value": "100.00"
      }
    }
  ],
  "payment_source": {
    "paypal": {
      "experience_context": {
        "payment_method_preference": "IMMEDIATE_PAYMENT_REQUIRED",
        "landing_page": "LOGIN",
        "shipping_preference": "GET_FROM_FILE",
        "user_action": "PAY_NOW",
        "return_url": "https://example.com/returnUrl",
        "cancel_url": "https://example.com/cancelUrl"
      }
    }
  }
}
```

### Required Fields

* `intent`: `"CAPTURE"` or `"AUTHORIZE"`

  * **CAPTURE**: immediately capture funds
  * **AUTHORIZE**: place funds on hold for later capture (valid for up to 29 days)
* `purchase_units`: array of 1–10 objects defining the items being purchased
* `payment_source`: defines the payment method (`paypal`, `card`, `vault_id`, etc.)

---

## Responses

### 200 – OK

> A successful response to an idempotent request returns HTTP 200 with the JSON body showing order details.

### 201 – Created

> A successful request returns HTTP 201 with a minimal response by default: order ID, status, and HATEOAS links.
> To receive the complete order resource, pass header:
> `Prefer: return=representation`

### 400 – Bad Request

> Request is syntactically incorrect, violates schema, or is malformed.

### 422 – Unprocessable Entity

> Requested action could not be performed, semantically incorrect, or failed business validation.

---

## Notes

* Multiple purchase units can be included, but `AUTHORIZE` intent does **not support multiple purchase units**.
* The `payer` object is deprecated; use `payment_source.paypal` instead.
* Optional `application_context` can be used to customize the payer experience.

---

# PayPal Orders API – Get Order Details

## Endpoint

```
GET /v2/checkout/orders/{id}
```

Shows details for a specific order by its ID.

> **Note:** For error handling and troubleshooting, see [Orders v2 errors](https://developer.paypal.com/docs/api/orders/v2/#errors).

---

## Security

* OAuth2 access token required in the `Authorization` header.
* Optional header: `PayPal-Auth-Assertion` — a JSON Web Token (JWT) identifying the merchant.

---

## Request

### Path Parameters

| Parameter | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| `id`      | string | yes      | The ID of the order (1–36 chars) |

### Query Parameters

| Parameter | Type   | Description                                                             |
| --------- | ------ | ----------------------------------------------------------------------- |
| `fields`  | string | Comma-separated list of fields to return. Valid value: `payment_source` |

---

## Sample Request (cURL)

```bash
curl -v -X GET https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T \
-H 'Authorization: Bearer <ACCESS_TOKEN>'
```

---

## Responses

### 200 – OK

> Returns order details in JSON format.

Example minimal response:

```json
{
  "id": "5O190127TN364715T",
  "status": "CREATED",
  "purchase_units": [
    {
      "reference_id": "PUHF",
      "amount": {
        "currency_code": "USD",
        "value": "100.00"
      }
    }
  ],
  "payer": {
    "name": { "given_name": "John", "surname": "Doe" },
    "email_address": "customer@example.com",
    "payer_id": "PAYERID123"
  }
}
```

### 404 – Not Found

> The specified resource does not exist.

---

# PayPal Orders API – Capture Payment for an Order

## Endpoint

```
POST /v2/checkout/orders/{id}/capture
```

Captures payment for an order.

> The buyer must first approve the order or a valid `payment_source` must be provided.
> A buyer can approve the order by visiting the `rel:approve` URL returned in the HATEOAS links in the create order response.

> **Note:** For error handling and troubleshooting, see [Orders v2 errors](https://developer.paypal.com/docs/api/orders/v2/#errors).

---

## Security

* OAuth2 access token required in the `Authorization` header.
* Optional header: `PayPal-Auth-Assertion` — a JSON Web Token (JWT) identifying the merchant.

---

## Request

### Path Parameters

| Parameter | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| `id`      | string | yes      | The ID of the order (1–36 chars) |

### Header Parameters

| Header                      | Type   | Description                                                                                         |
| --------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `PayPal-Request-Id`         | string | Idempotency key (1–108 chars). Keys stored 6 hours by default; can request up to 72 hours. |
| `Prefer`                    | string | Default: `return=minimal`. Use `return=representation` to get full resource details.                |
| `PayPal-Client-Metadata-Id` | string | Optional, 1–36 chars                                                                                |
| `PayPal-Auth-Assertion`     | string | Optional JWT identifying the merchant                                                               |

### Request Body

* `payment_source` (object) — Optional. Defines a payment source.
* Content-Type: `application/json`.

Minimal request body example:

```json
{}
```

---

## Sample Request (cURL)

```bash
curl -v -X POST https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T/capture \
-H 'Content-Type: application/json' \
-H 'PayPal-Request-Id: 7b92603e-77ed-4896-8e78-5dea2050476a' \
-H 'Authorization: Bearer <ACCESS_TOKEN>' \
-d '{}'
```

---

## Responses

### 200 – OK

> Successful response to an idempotent request. Returns captured payment details (minimal by default).

### 201 – Created

> Successful response to a non-idempotent request. Returns captured payment details. If the request is retried, returns 200 OK.

### 403 – Forbidden

> Authorized payment failed due to insufficient permissions.

### 404 – Not Found

> The specified order does not exist.

### 422 – Unprocessable Entity

> Requested action could not be performed, semantically incorrect, or failed business validation.

---
