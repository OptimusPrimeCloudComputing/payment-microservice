// server.js
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const yaml = require("yamljs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const { initializeDatabase } = require("./init-db");

const app = express();

// CORS Configuration - Allow all origins for development
app.use(cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Swagger UI setup
const swaggerDocument = yaml.load(path.join(__dirname, "openapi/openapi.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ============================================================
// Database Helper Functions
// ============================================================

/**
 * Convert database row to API response format
 */
function dbRowToPayment(row) {
    if (!row) return null;
    
    return {
        paymentId: row.id,
        orderId: row.order_id,
        status: row.status,
        amount: row.amount_cents,
        currency: row.currency,
        method: row.method,
        transactionRef: row.transaction_ref,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        metadata: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : (row.metadata_json || {}),
        clientNote: row.client_note,
    };
}

/**
 * Get payment by ID from database
 */
async function getPayment(paymentId) {
    try {
        const rows = await db.query(
            'SELECT * FROM payments WHERE id = ?',
            [paymentId]
        );
        return rows.length > 0 ? dbRowToPayment(rows[0]) : null;
    } catch (error) {
        console.error('Error getting payment:', error);
        throw error;
    }
}

// ============================================================
// Health Check Endpoint
// ============================================================

app.get("/health", async (req, res) => {
    try {
        const dbHealthy = await db.testConnection();
        res.json({
            status: dbHealthy ? "healthy" : "unhealthy",
            database: dbHealthy ? "connected" : "disconnected",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: "unhealthy",
            database: "error",
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================================
// Payment Endpoints
// ============================================================

/**
 * POST /payments/initiate
 * Initiate a new payment
 */
app.post("/payments/initiate", async (req, res) => {
    try {
        const paymentId = crypto.randomUUID();
        const {
            orderId = "ord_demo",
            amount = 0,
            currency = "USD",
            method = "CARD",
            metadata = {},
        } = req.body || {};

        const createdAt = new Date();

        // Insert into database
        await db.query(
            `INSERT INTO payments (
                id, order_id, status, amount_cents, currency, method,
                transaction_ref, created_at, client_note, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                paymentId,
                orderId,
                'INITIATED',
                amount,
                currency,
                method,
                null, // transaction_ref
                createdAt,
                null, // client_note
                JSON.stringify(metadata)
            ]
        );

        res.status(201).json({
            paymentId,
            orderId,
            status: 'INITIATED',
            amount,
            currency,
            method,
            transactionRef: null,
            createdAt: createdAt.toISOString(),
            metadata,
            clientNote: null,
            redirectUrl: "https://fakepay.test/redirect/demo",
        });
    } catch (error) {
        console.error('Error initiating payment:', error);
        res.status(500).json({
            message: "Failed to initiate payment",
            error: error.message
        });
    }
});

/**
 * GET /payments/:payment_id
 * Get payment details by ID
 */
app.get("/payments/:payment_id", async (req, res) => {
    try {
        const paymentId = req.params.payment_id;
        const payment = await getPayment(paymentId);
        
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }
        
        res.json(payment);
    } catch (error) {
        console.error('Error getting payment:', error);
        res.status(500).json({
            message: "Failed to retrieve payment",
            error: error.message
        });
    }
});

/**
 * PATCH /payments/:payment_id
 * Update payment metadata or client notes
 */
app.patch("/payments/:payment_id", async (req, res) => {
    try {
        const paymentId = req.params.payment_id;
        const payment = await getPayment(paymentId);
        
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        const { metadata, clientNote } = req.body || {};
        
        // Merge metadata if provided
        let updatedMetadata = payment.metadata;
        if (metadata && typeof metadata === "object") {
            updatedMetadata = { ...payment.metadata, ...metadata };
        }
        
        // Update client note if provided
        const updatedClientNote = typeof clientNote === "string" ? clientNote : payment.clientNote;

        // Update database
        await db.query(
            `UPDATE payments 
             SET metadata_json = ?, client_note = ? 
             WHERE id = ?`,
            [JSON.stringify(updatedMetadata), updatedClientNote, paymentId]
        );

        // Get updated payment
        const updatedPayment = await getPayment(paymentId);

        res.status(202).json({
            paymentId,
            accepted: true,
            message: "Metadata/notes recorded",
            current: updatedPayment,
        });
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).json({
            message: "Failed to update payment",
            error: error.message
        });
    }
});

/**
 * DELETE /payments/:payment_id
 * Cancel/fail a payment
 */
app.delete("/payments/:payment_id", async (req, res) => {
    try {
        const paymentId = req.params.payment_id;
        const payment = await getPayment(paymentId);
        
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        // Update status to FAILED
        await db.query(
            'UPDATE payments SET status = ? WHERE id = ?',
            ['FAILED', paymentId]
        );

        // Get updated payment
        const updatedPayment = await getPayment(paymentId);

        res.status(202).json({
            paymentId,
            accepted: true,
            providerAction: "void_intent",
            current: updatedPayment,
        });
    } catch (error) {
        console.error('Error deleting payment:', error);
        res.status(500).json({
            message: "Failed to cancel payment",
            error: error.message
        });
    }
});

/**
 * POST /payments/webhook
 * Handle webhook events from payment provider
 */
app.post("/payments/webhook", async (req, res) => {
    try {
        const { event, paymentId, transactionRef, amount } = req.body || {};
        
        // Log webhook event (optional)
        if (paymentId) {
            await db.query(
                `INSERT INTO webhook_events (event_type, payment_id, payload_json, received_at, signature)
                 VALUES (?, ?, ?, ?, ?)`,
                [event, paymentId, JSON.stringify(req.body), new Date(), null]
            );
        }

        // Update payment based on event
        if (paymentId) {
            const payment = await getPayment(paymentId);
            
            if (payment) {
                let newStatus = payment.status;
                let updatedAmount = payment.amount;
                let updatedTransactionRef = payment.transactionRef;

                if (typeof amount === "number") updatedAmount = amount;
                if (transactionRef) updatedTransactionRef = transactionRef;

                if (event === "payment.succeeded") newStatus = "SUCCESS";
                else if (event === "payment.failed") newStatus = "FAILED";
                else if (event === "refund.succeeded") newStatus = "REFUNDED";
                else if (event === "refund.failed") newStatus = "FAILED";

                // Update payment
                await db.query(
                    `UPDATE payments 
                     SET status = ?, amount_cents = ?, transaction_ref = ?
                     WHERE id = ?`,
                    [newStatus, updatedAmount, updatedTransactionRef, paymentId]
                );
            }
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        // Always return 200 for webhooks to prevent retries
        res.json({ received: true, error: error.message });
    }
});

/**
 * POST /payments/refund/:payment_id
 * Initiate a refund for a payment
 */
app.post("/payments/refund/:payment_id", async (req, res) => {
    try {
        const paymentId = req.params.payment_id;
        const { amount } = req.body || {};
        
        const payment = await getPayment(paymentId);

        if (!payment) {
            return res.status(404).json({ message: `Payment ${paymentId} not found` });
        }

        const refundId = "rf_" + crypto.randomUUID().slice(0, 8);
        const refundAmount = typeof amount === "number" ? amount : payment.amount;

        // Update payment status
        await db.query(
            'UPDATE payments SET status = ? WHERE id = ?',
            ['REFUND_PENDING', paymentId]
        );

        // Insert refund record
        await db.query(
            `INSERT INTO refunds (id, payment_id, amount_cents, status, reason, requested_at, processed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [refundId, paymentId, refundAmount, 'PENDING', null, new Date(), null]
        );

        // Get updated payment
        const updatedPayment = await getPayment(paymentId);

        return res.status(202).json({
            message: `Refund initiated for payment ${paymentId}`,
            refundId,
            paymentId,
            amount: refundAmount,
            status: "PENDING",
            current: updatedPayment,
        });
    } catch (error) {
        console.error('Error initiating refund:', error);
        res.status(500).json({
            message: "Failed to initiate refund",
            error: error.message
        });
    }
});

// ============================================================
// Server Initialization
// ============================================================

const PORT = process.env.PORT || 4003;

async function startServer() {
    try {
        console.log('🚀 Starting Payment Microservice...');
        
        // Initialize database connection
        db.initializePool();
        
        // Test database connection
        const dbConnected = await db.testConnection();
        if (!dbConnected) {
            console.warn('⚠️  Database connection failed, but server will start anyway');
        }
        
        // Initialize database schema (if needed)
        if (process.env.AUTO_INIT_DB === 'true') {
            console.log('🔧 Auto-initializing database schema...');
            await initializeDatabase();
        }
        
        // Start Express server
        app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
            console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
            console.log(`🏥 Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing database connections...');
    await db.closePool();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing database connections...');
    await db.closePool();
    process.exit(0);
});

// Start the server
startServer();
