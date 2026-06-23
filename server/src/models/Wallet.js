const pool = require('../config/db');

class Wallet {
    /**
     * Initializes the Wallet table and seeds a test user if the table is empty.
     */
    static async initializeSchema() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS wallets (
                user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                username VARCHAR(50) UNIQUE NOT NULL,
                usd_balance DECIMAL(18, 8) NOT NULL DEFAULT 0.0,
                btc_balance DECIMAL(18, 8) NOT NULL DEFAULT 0.0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        const seedDataQuery = `
            INSERT INTO wallets (user_id, username, usd_balance, btc_balance)
            VALUES ('00000000-0000-0000-0000-000000000001', 'test_trader', 10000.00, 0.00)
            ON CONFLICT (username) DO NOTHING;
        `;

        try {
            await pool.query(createTableQuery);
            await pool.query(seedDataQuery);
            console.log('✅ Wallet schema initialized and seeded');
        } catch (error) {
            console.error('❌ Wallet schema initialization failed:', error);
        }
    }
    /**
     * Executes a paper trade with strict ACID compliance to prevent race conditions.
     * @param {string} userId - The UUID of the user
     * @param {string} side - 'BUY' or 'SELL'
     * @param {number} amountUSD - The amount of USD to spend or receive
     * @param {number} currentExecutionPrice - The exact BTC price from the Redis cache
     */
    static async executeTrade(userId, side, amountUSD, currentExecutionPrice) {
        // Grab a dedicated connection from the pool for this transaction
        const client = await pool.connect();

        try {
            // 1. Initiate the Atomic Transaction
            await client.query('BEGIN');

            // 2. Lock the specific user's row. 
            // Any concurrent request trying to read/write this row will be forced to wait.
            const lockQuery = `
                SELECT usd_balance, btc_balance 
                FROM wallets 
                WHERE user_id = $1 
                FOR UPDATE; 
            `;
            const lockResult = await client.query(lockQuery, [userId]);

            if (lockResult.rows.length === 0) {
                throw new Error('Wallet not found');
            }

            const wallet = lockResult.rows[0];
            const usdBalance = parseFloat(wallet.usd_balance);
            const btcBalance = parseFloat(wallet.btc_balance);

            // Calculate the BTC equivalent of the USD amount requested
            const btcAmount = amountUSD / currentExecutionPrice;

            // 3. Execution Logic & Balance Verification
            let updateQuery;
            let updateValues;

            if (side === 'BUY') {
                if (usdBalance < amountUSD) throw new Error('Insufficient USD funds');

                updateQuery = `
                    UPDATE wallets 
                    SET usd_balance = usd_balance - $1, 
                        btc_balance = btc_balance + $2 
                    WHERE user_id = $3
                    RETURNING usd_balance, btc_balance;
                `;
                updateValues = [amountUSD, btcAmount, userId];

            } else if (side === 'SELL') {
                if (btcBalance < btcAmount) throw new Error('Insufficient BTC funds');

                updateQuery = `
                    UPDATE wallets 
                    SET usd_balance = usd_balance + $1, 
                        btc_balance = btc_balance - $2 
                    WHERE user_id = $3
                    RETURNING usd_balance, btc_balance;
                `;
                updateValues = [amountUSD, btcAmount, userId];
            } else {
                throw new Error('Invalid trade side. Must be BUY or SELL.');
            }

            // 4. Execute the update
            const finalResult = await client.query(updateQuery, updateValues);

            // 5. Finalize the Transaction
            await client.query('COMMIT');

            return {
                status: 'SUCCESS',
                executionPrice: currentExecutionPrice,
                newBalances: finalResult.rows[0]
            };

        } catch (error) {
            // If ANYTHING fails (insufficient funds, network error), revert all changes instantly
            await client.query('ROLLBACK');
            throw error;
        } finally {
            // Release the connection back to the pool
            client.release();
        }
    }
}

module.exports = Wallet;