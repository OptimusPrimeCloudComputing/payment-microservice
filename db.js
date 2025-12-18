// db.js - Database connection and query utilities
const mysql = require('mysql2/promise');

let pool = null;

/**
 * Initialize database connection pool
 * Supports both Cloud SQL (via Unix socket) and direct TCP connection
 */
function initializePool() {
    if (pool) {
        return pool;
    }

    const config = {
        // Connection limit
        connectionLimit: 10,
        
        // Timeouts
        connectTimeout: 10000,
        acquireTimeout: 10000,
        
        // Database name
        database: process.env.DB_NAME || 'payments',
        
        // User credentials
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        
        // Enable timezone handling
        timezone: 'Z',
        
        // Date handling
        dateStrings: false,
    };

    // Check if running on Cloud Run with Cloud SQL
    if (process.env.INSTANCE_UNIX_SOCKET) {
        // Cloud SQL connection via Unix socket (recommended for Cloud Run)
        config.socketPath = process.env.INSTANCE_UNIX_SOCKET;
        console.log('Using Cloud SQL Unix socket:', config.socketPath);
    } else if (process.env.DB_HOST) {
        // Direct TCP connection (for local development or external connection)
        config.host = process.env.DB_HOST;
        config.port = parseInt(process.env.DB_PORT || '3306', 10);
        console.log('Using TCP connection to:', config.host + ':' + config.port);
    } else {
        console.error('No database connection method specified. Set INSTANCE_UNIX_SOCKET or DB_HOST');
        throw new Error('Database configuration missing');
    }

    pool = mysql.createPool(config);
    
    console.log('Database connection pool initialized');
    return pool;
}

/**
 * Get database connection pool (creates if not exists)
 */
function getPool() {
    if (!pool) {
        return initializePool();
    }
    return pool;
}

/**
 * Execute a query with automatic connection handling
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
async function query(sql, params = []) {
    const pool = getPool();
    const [rows] = await pool.execute(sql, params);
    return rows;
}

/**
 * Get a connection from the pool (for transactions)
 * Remember to release the connection after use!
 */
async function getConnection() {
    const pool = getPool();
    return await pool.getConnection();
}

/**
 * Test database connection
 */
async function testConnection() {
    try {
        const pool = getPool();
        await pool.query('SELECT 1 AS test');
        console.log('✅ Database connection test successful');
        return true;
    } catch (error) {
        console.error('❌ Database connection test failed:', error.message);
        return false;
    }
}

/**
 * Close all connections in the pool
 */
async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('Database connection pool closed');
    }
}

module.exports = {
    initializePool,
    getPool,
    query,
    getConnection,
    testConnection,
    closePool,
};

