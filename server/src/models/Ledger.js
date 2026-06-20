const pool = require('../config/db');

class Ledger {
    /**
     * Initializes the database schema. 
     * Creates the table if it doesn't exist and adds an index for fast time-series queries.
     */
    static async initializeSchema() {
        const query = `
            CREATE TABLE IF NOT EXISTS price_history (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                symbol VARCHAR(20) NOT NULL,
                price DECIMAL(18, 8) NOT NULL,
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Index to optimize querying chronological history for the frontend chart
            CREATE INDEX IF NOT EXISTS idx_symbol_recorded_at 
            ON price_history(symbol, recorded_at DESC);
        `;
        try {
            await pool.query(query);
            console.log('✅ Ledger schema initialized');
        } catch (error) {
            console.error('❌ Schema initialization failed:', error);
        }
    }

    /**
     * Inserts a throttled price snapshot into the ledger.
     */
    static async insertPrice(symbol, price) {
        const query = `
            INSERT INTO price_history (symbol, price)
            VALUES ($1, $2)
            RETURNING id, symbol, price, recorded_at;
        `;
        const values = [symbol, price];

        try {
            const result = await pool.query(query, values);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Failed to insert price:', error);
            throw error;
        }
    }

    /**
     * Fetches the historical data for the initial React chart load.
     * Limits to the last 100 entries to prevent payload bloat.
     */
    static async getHistory(symbol, limit = 100) {
        const query = `
            SELECT id, symbol, price, recorded_at 
            FROM price_history 
            WHERE symbol = $1 
            ORDER BY recorded_at DESC 
            LIMIT $2;
        `;
        const values = [symbol, limit];

        try {
            const result = await pool.query(query, values);
            // Reverse to return in chronological order (oldest to newest) for Recharts
            return result.rows.reverse();
        } catch (error) {
            console.error('❌ Failed to fetch history:', error);
            throw error;
        }
    }
}

module.exports = Ledger;