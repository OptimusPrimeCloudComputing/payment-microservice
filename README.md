# Payment Microservice API Docs

This project serves the OpenAPI specification for the **Payment Microservice** using Swagger UI.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open the Swagger docs:

   - After running, the terminal will show a link like:

     ```
     Payment Service docs available at http://localhost:4003/api-docs
     ```

   - Click that link or paste it in your browser.

---

## Development Mode

For auto-reload during development:

```bash
npm run dev
```

---

## Project Structure

```
Payment-Service/
  ├── server.js          # Express app serving Swagger UI
  ├── package.json       # Project dependencies and scripts
  ├── openapi/
  |   └── openapi.yaml # OpenAPI 3.0 spec for Payment Service
  └── README.md
```

---
