// server.js
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const yaml = require("yamljs");
const path = require("path");

const app = express();
app.use(express.json());

const swaggerDocument = yaml.load(path.join(__dirname, "openapi/openapi.yaml"));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.post("/payments/initiate", (req, res) => {
    res.status(201).json({
        paymentId: "pay_demo",
        status: "INITIATED",
        amount: req.body?.amount ?? 0,
        currency: req.body?.currency ?? "USD",
        method: req.body?.method ?? "CARD",
        redirectUrl: "https://fakepay.test/redirect/demo"
    });
});

app.get("/payments/:payment_id", (req, res) => {
    res.json({
        paymentId: req.params.paymentId ?? "pay_demo",
        orderId: "ord_demo",
        status: "PENDING",
        amount: 1234,
        currency: "USD",
        method: "CARD",
        transactionRef: req.query?.transactionRef ?? "txn_demo",
        createdAt: new Date().toISOString()
    });
});

app.post("/payments/webhook", (req, res) => res.json({ received: true }));

app.post("/payments/refund", (req, res) =>
    res.status(202).json({ refundId: "rf_demo", paymentId: req.body?.paymentId ?? "pay_demo", amount: req.body?.amount ?? 1234, status: "PENDING" })
);


const PORT = 4003;
app.listen(PORT, () => {
    console.log(`Server on http://localhost:${PORT}`);
    console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});
