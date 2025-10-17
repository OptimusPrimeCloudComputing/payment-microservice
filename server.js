// server.js
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const yaml = require("yamljs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// ---- In-memory store (persists while the process runs) ----
// payments[paymentId] = {
//   paymentId, orderId, status, amount, currency, method,
//   transactionRef, createdAt, metadata, clientNote
// }

const payments = Object.create(null);

const swaggerDocument = yaml.load(path.join(__dirname, "openapi/openapi.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const getPayment = (id) => payments[id] || null;

app.post("/payments/initiate", (req, res) => {
    const paymentId = crypto.randomUUID();
    const {
        orderId = "ord_demo",
        amount = 0,
        currency = "USD",
        method = "CARD",
        metadata = {},
    } = req.body || {};

    payments[paymentId] = {
        paymentId,
        orderId,
        status: "INITIATED",
        amount,
        currency,
        method,
        transactionRef: null,
        createdAt: new Date().toISOString(),
        metadata,
        clientNote: null,
    };

    res.status(201).json({
        ...payments[paymentId],
        redirectUrl: "https://fakepay.test/redirect/demo",
    });
});

app.get("/payments/:payment_id", (req, res) => {
    const paymentId = req.params.payment_id;
    const p = getPayment(paymentId);
    if (!p) return res.status(404).json({ message: "Payment not found" });
    res.json(p);
});

app.patch("/payments/:payment_id", (req, res) => {
    const paymentId = req.params.payment_id;
    const p = getPayment(paymentId);
    if (!p) return res.status(404).json({ message: "Payment not found" });

    const { metadata, clientNote } = req.body || {};
    if (metadata && typeof metadata === "object") {
        p.metadata = { ...p.metadata, ...metadata };
    }
    if (typeof clientNote === "string") {
        p.clientNote = clientNote;
    }

    res.status(202).json({
        paymentId,
        accepted: true,
        message: "Metadata/notes recorded (demo)",
        current: p,
    });
});

app.delete("/payments/:payment_id", (req, res) => {
    const paymentId = req.params.payment_id;
    const p = getPayment(paymentId);
    if (!p) return res.status(404).json({ message: "Payment not found" });

    p.status = "FAILED";
    res.status(202).json({
        paymentId,
        accepted: true,
        providerAction: "void_intent",
        current: p,
    });
});

app.post("/payments/webhook", (req, res) => {
    const { event, paymentId, transactionRef, amount } = req.body || {};
    const p = paymentId ? payments[paymentId] : null;

    if (p) {
        if (typeof amount === "number") p.amount = amount;
        if (transactionRef) p.transactionRef = transactionRef;

        if (event === "payment.succeeded") p.status = "SUCCESS";
        else if (event === "payment.failed") p.status = "FAILED";
        else if (event === "refund.succeeded") p.status = "REFUNDED";
        else if (event === "refund.failed") p.status = "FAILED";
    }

    res.json({ received: true });
});

app.post("/payments/refund/:payment_id", (req, res) => {
    const paymentId = req.params.payment_id;
    const { amount } = req.body || {};
    const payment = payments[paymentId];

    if (!payment) {
        return res.status(404).json({ message: `Payment ${paymentId} not found` });
    }

    const refundId = "rf_" + Math.random().toString(36).slice(2, 8);
    const refundAmount = typeof amount === "number" ? amount : payment.amount;

    payment.status = "REFUND_PENDING";
    payment.refund = {
        refundId,
        amount: refundAmount,
        requestedAt: new Date().toISOString(),
    };

    return res.status(202).json({
        message: `Refund initiated for payment ${paymentId}`,
        refundId,
        paymentId,
        amount: refundAmount,
        status: "PENDING",
        current: payment,
    });
});

const PORT = 4003;
app.listen(PORT, () => {
    console.log(`Server on http://localhost:${PORT}`);
    console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});
