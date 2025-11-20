-- Payment Microservice - MySQL Schema & Seed Data

USE payments;

-- ==========================================================
-- TABLE: payments
-- ==========================================================

CREATE TABLE IF NOT EXISTS payments (
    id              VARCHAR(64) PRIMARY KEY,
    order_id        VARCHAR(64) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    amount_cents    BIGINT NOT NULL,
    currency        VARCHAR(3) NOT NULL,
    method          VARCHAR(20) NOT NULL,
    transaction_ref VARCHAR(128) NULL,
    created_at      DATETIME NOT NULL,
    client_note     TEXT NULL,
    metadata_json   JSON NULL
) ENGINE=InnoDB;

CREATE INDEX idx_payments_order_id   ON payments(order_id);
CREATE INDEX idx_payments_status     ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- ==========================================================
-- TABLE: refunds
-- ==========================================================

CREATE TABLE IF NOT EXISTS refunds (
    id              VARCHAR(64) PRIMARY KEY,
    payment_id      VARCHAR(64) NOT NULL,
    amount_cents    BIGINT NOT NULL,
    status          VARCHAR(20) NOT NULL,
    reason          VARCHAR(50) NULL,
    requested_at    DATETIME NOT NULL,
    processed_at    DATETIME NULL,
    CONSTRAINT fk_refunds_payment
      FOREIGN KEY (payment_id) REFERENCES payments(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_refunds_payment_id    ON refunds(payment_id);
CREATE INDEX idx_refunds_status        ON refunds(status);
CREATE INDEX idx_refunds_requested_at  ON refunds(requested_at);

-- ==========================================================
-- TABLE: webhook_events (optional)
-- ==========================================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_type      VARCHAR(50) NOT NULL,
    payment_id      VARCHAR(64) NULL,
    payload_json    JSON NOT NULL,
    received_at     DATETIME NOT NULL,
    signature       VARCHAR(256) NULL,
    INDEX idx_webhook_events_payment_id (payment_id),
    INDEX idx_webhook_events_event_type (event_type),
    INDEX idx_webhook_events_received   (received_at)
) ENGINE=InnoDB;

-- ==========================================================
-- SEED DATA
-- ==========================================================

-- Seed payments
INSERT IGNORE INTO payments (
    id, order_id, status, amount_cents, currency, method,
    transaction_ref, created_at, client_note, metadata_json
) VALUES
    ('pay_demo_1', 'ord_1001', 'INITIATED', 4999,  'USD', 'CARD',   NULL,    '2025-10-02 20:00:00', NULL,
        JSON_OBJECT('userId', 'u_42', 'cartId', 'c_123')),
    ('pay_demo_2', 'ord_1002', 'SUCCESS',   12999, 'USD', 'PAYPAL', 'tx_777','2025-10-03 14:30:00', 'VIP customer, handle with care',
        JSON_OBJECT('userId', 'u_77')),
    ('pay_demo_3', 'ord_1003', 'FAILED',    2599,  'USD', 'CARD',   'tx_888','2025-10-04 09:15:00', NULL,
        JSON_OBJECT('userId', 'u_15', 'failureReason', 'card_declined')),
    ('pay_demo_4', 'ord_1004', 'REFUNDED',  7999,  'USD', 'CARD',   'tx_999','2025-10-05 18:45:00', 'Customer requested refund',
        JSON_OBJECT('userId', 'u_99'));

-- Seed refunds
INSERT IGNORE INTO refunds (
    id, payment_id, amount_cents, status, reason, requested_at, processed_at
) VALUES
    ('rf_demo_1', 'pay_demo_4', 7999, 'SUCCESS', 'CUSTOMER_REQUEST',
        '2025-10-06 10:00:00', '2025-10-06 10:05:00'),
    ('rf_demo_2', 'pay_demo_2', 4999, 'PENDING', 'OTHER',
        '2025-10-07 12:20:00', NULL);

-- Seed webhook_events
INSERT INTO webhook_events (
    event_type, payment_id, payload_json, received_at, signature
) VALUES
    ('payment.succeeded', 'pay_demo_2',
        JSON_OBJECT('event', 'payment.succeeded', 'paymentId', 'pay_demo_2',
                    'transactionRef', 'tx_777', 'amount', 12999),
        '2025-10-03 14:30:05', 'hmac_demo_sig_1'),
    ('refund.succeeded',  'pay_demo_4',
        JSON_OBJECT('event', 'refund.succeeded', 'paymentId', 'pay_demo_4',
                    'amount', 7999),
        '2025-10-06 10:05:05', 'hmac_demo_sig_2');