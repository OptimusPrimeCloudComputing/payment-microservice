// init-db.js - Database initialization and schema setup
const db = require('./db');
const fs = require('fs');
const path = require('path');

/**
 * Initialize database schema and seed data
 */
async function initializeDatabase() {
    try {
        console.log('🔧 Initializing database...');
        
        // Test connection first
        const connected = await db.testConnection();
        if (!connected) {
            throw new Error('Could not connect to database');
        }

        // Read and execute schema file
        const schemaPath = path.join(__dirname, 'db_schema.sql');
        
        if (fs.existsSync(schemaPath)) {
            console.log('📄 Reading schema file...');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Split by statement (simple approach - split by semicolons)
            const statements = schema
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('USE'));
            
            console.log(`📝 Executing ${statements.length} SQL statements...`);
            
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        await db.query(statement);
                    } catch (error) {
                        // Ignore errors for CREATE IF NOT EXISTS and INSERT IGNORE
                        if (!error.message.includes('already exists') && 
                            !error.message.includes('Duplicate entry')) {
                            console.warn('Warning executing statement:', error.message);
                        }
                    }
                }
            }
            
            console.log('✅ Database schema initialized successfully');
        } else {
            console.log('⚠️  Schema file not found, skipping initialization');
        }

        // Verify tables exist
        const tables = await db.query('SHOW TABLES');
        console.log('📊 Available tables:', tables.map(t => Object.values(t)[0]).join(', '));
        
        return true;
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        return false;
    }
}

/**
 * Run initialization if called directly
 */
if (require.main === module) {
    initializeDatabase()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };

