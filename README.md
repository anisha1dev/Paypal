![PayPal Order Flow](https://www.paypalobjects.com/ppdevdocs/orders-api/orders-api-standard-flow.png)
---

# PayPal OAuth2 Token

## cURL

```bash
curl -v -X POST "https://api-m.sandbox.paypal.com/v1/oauth2/token" \
 -u "CLIENT_ID:CLIENT_SECRET" \
 -H "Content-Type: application/x-www-form-urlencoded" \
 -d "grant_type=client_credentials"
```

### Notes

* Replace `CLIENT_ID` and `CLIENT_SECRET` with your credentials.
* [Official Docs](https://developer.paypal.com/api/rest/#link-getaccesstoken)

### Sample Response

```json
{
  "access_token": "A21AA...",
  "token_type": "Bearer",
  "expires_in": 31668
}
```

---

# Create Order

```
POST /v2/checkout/orders
```

### Request Headers

* `Authorization: Bearer <ACCESS_TOKEN>`
* `PayPal-Request-Id`: idempotency key (mandatory for payment source)
* Optional: `Prefer: return=minimal|return=representation`

### Request Body

```json
{
  "intent": "CAPTURE",
  "purchase_units": [{"amount":{"currency_code":"USD","value":"100.00"}}],
  "payment_source": {"paypal":{"experience_context":{"return_url":"https://example.com/return","cancel_url":"https://example.com/cancel"}}}
}
```

### Responses

* **200**: idempotent, order details
* **201**: minimal order created
* **400**: bad request
* **422**: failed business validation

[Official Docs](https://developer.paypal.com/docs/api/orders/v2/#orders_create)

---

# Get Order Details

```
GET /v2/checkout/orders/{id}
```

### Responses

* **200**: order details
* **404**: not found

### Sample cURL

```bash
curl -v -X GET https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER_ID \
-H 'Authorization: Bearer <ACCESS_TOKEN>'
```

[Official Docs](https://developer.paypal.com/docs/api/orders/v2/#orders_get)

---

# Capture Payment

```
POST /v2/checkout/orders/{id}/capture
```

### Request Headers

* `Authorization: Bearer <ACCESS_TOKEN>`
* `PayPal-Request-Id`: Idempotency key
* `Prefer`: optional, default `return=minimal`

### Request Body (minimal)

```json
{}
```

### Responses

* **200**: idempotent capture
* **201**: new capture
* **403**: insufficient permissions
* **404**: order not found
* **422**: semantic/business error

### Sample cURL

```bash
curl -v -X POST https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER_ID/capture \
-H 'Content-Type: application/json' \
-H 'PayPal-Request-Id: REQUEST_ID' \
-H 'Authorization: Bearer <ACCESS_TOKEN>' \
-d '{}'
```

[Official Docs](https://developer.paypal.com/docs/api/orders/v2/#orders_capture)

---

