const WebSocket = require('ws');
const Ledger = require('../models/Ledger');

// Binance raw WebSocket endpoint for BTC/USDT trades
const BINANCE_WS_URL = process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws/btcusdt@trade';

// Throttle configuration: 30 seconds (30,000 ms)
const DB_WRITE_THROTTLE_MS = 30000;
let lastDbWriteTime = 0;

/**
 * Initializes the WebSocket connection to the exchange.
 * @param {Object} io - The initialized Socket.IO server instance
 */
function startMarketStream(io) {
    const ws = new WebSocket(BINANCE_WS_URL);

    ws.on('open', () => {
        console.log('🔗 Connected to Binance Market Stream');
    });

    ws.on('message', async (data) => {
        try {
            const trade = JSON.parse(data);

            // Binance payload mapping: 's' = symbol, 'p' = price, 'E' = event time
            const symbol = trade.s;
            const price = parseFloat(trade.p);

            // Clean payload for our frontend
            const payload = {
                symbol,
                price,
                timestamp: trade.E
            };

            // 1. THE FAST PATH: Broadcast immediately to React clients via Socket.IO
            io.emit('live_price_update', payload);

            // 2. THE SLOW PATH: Throttled database insertion for historical ledger
            const now = Date.now();
            if (now - lastDbWriteTime >= DB_WRITE_THROTTLE_MS) {
                lastDbWriteTime = now;
                await Ledger.insertPrice(symbol, price);
                console.log(`💾 Ledger Snapshot Saved: ${symbol} @ $${price}`);
            }

        } catch (error) {
            console.error('❌ Error processing stream data:', error);
        }
    });

    // Production reliability: Auto-reconnect on disconnect
    ws.on('close', () => {
        console.warn('⚠️ Market stream disconnected. Attempting reconnect in 5 seconds...');
        setTimeout(() => startMarketStream(io), 5000);
    });

    ws.on('error', (err) => {
        console.error('❌ Market stream error:', err.message);
        ws.close(); // Force close to trigger the auto-reconnect logic
    });
}

module.exports = startMarketStream;