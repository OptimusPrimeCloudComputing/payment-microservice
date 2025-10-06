# Payment Microservice

The **Payment Microservice** provides endpoints for handling order payments, payment status checks, refunds, and webhook callbacks from external payment providers.
It is designed to follow the **API-First** approach with an OpenAPI 3.0 specification served via Swagger UI.

---

## Features

- **Initiate Payment**: Start a payment process and return a payment intent/link.
- **Payment Status**: Retrieve the status of a payment by ID.
- **Webhook Handling**: Accept callbacks from external payment providers.
- **Refunds**: Trigger refunds for existing payments.

---

## Tech Stack

- **Framework**: Node.js + Express
- **API Docs**: Swagger UI (OpenAPI 3.0 spec)
- **Language**: JavaScript

---

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open the Swagger docs in your browser:

   ```
   http://localhost:4003/api-docs
   ```

---

## Development Mode

Run with auto-reload during development:

```bash
npm run dev
```

---

## Project Structure

```
Payment-Service/
  ├── server.js          # Express app with routes + Swagger UI
  ├── package.json       # Dependencies and scripts
  ├── openapi/
  │   └── openapi.yaml   # OpenAPI 3.0 spec
  └── README.md
```

---

## API Documentation

Swagger UI: [http://localhost:4003/api-docs](http://localhost:4003/api-docs)

### Endpoints

#### Payments

| Method   | Endpoint                 | Description                                                |
| -------- | ------------------------ | ---------------------------------------------------------- |
| **POST** | `/payments/initiate`     | Initiate a new payment (returns payment ID + redirect URL) |
| **GET**  | `/payments/{payment_id}` | Get payment status/details                                 |
| **POST** | `/payments/webhook`      | Webhook callback from external payment provider            |
| **POST** | `/payments/refund`       | Trigger a refund for a completed payment                   |

---

## Example Usage (cURL)

Initiate a payment:

```bash
curl -X POST http://localhost:4003/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ord_123",
    "amount": 4999,
    "currency": "USD",
    "method": "CARD",
    "returnUrl": "https://shop.example.com/checkout/return"
  }'
```

Webhook simulation:

```bash
curl -X POST http://localhost:4003/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.succeeded",
    "paymentId": "pay_demo",
    "transactionRef": "tx_777",
    "amount": 4999
  }'
```
