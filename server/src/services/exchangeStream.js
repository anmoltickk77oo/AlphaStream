const WebSocket = require('ws');
const Redis = require('ioredis');

// Binance raw WebSocket endpoint for BTC/USDT trades
const BINANCE_WS_URL = process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws/btcusdt@trade';

// Initialize Redis Publisher
const redisPublisher = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
});

redisPublisher.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
});

// Exponential Backoff Configuration
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
let currentReconnectDelay = 1000;  // Starts at 1 second

// Throttling configuration for Redis (publish max 5 times per second)
const REDIS_PUBLISH_INTERVAL_MS = 200; // 5 updates/sec
let lastPublishTime = 0;

/**
 * Initializes the WebSocket connection to the exchange (The Ingestion Worker).
 */
function startMarketStream() {
    console.log(`[Circuit Breaker] Connecting to Binance...`);
    const ws = new WebSocket(BINANCE_WS_URL);

    ws.on('open', () => {
        console.log('🔗 Connected to Binance Market Stream');
        // Reset the circuit breaker delay on a successful connection
        currentReconnectDelay = 1000;
    });

    ws.on('message', (data) => {
        try {
            const trade = JSON.parse(data);

            const symbol = trade.s;
            const price = parseFloat(trade.p);

            const payload = {
                symbol,
                price,
                timestamp: trade.E
            };

            const now = Date.now();

            // Throttle Redis publishing to avoid blowing up the network
            if (now - lastPublishTime >= REDIS_PUBLISH_INTERVAL_MS) {
                lastPublishTime = now;
                // PUBLISH to the MARKET_DATA channel
                redisPublisher.publish('MARKET_DATA', JSON.stringify(payload));
            }
        } catch (error) {
            console.error('❌ Error processing stream data:', error);
        }
    });

    ws.on('close', () => {
        console.warn(`⚠️ Market stream disconnected.`);
        triggerCircuitBreakerReconnect();
    });

    ws.on('error', (err) => {
        console.error('❌ Market stream error:', err.message);
        // Do not call reconnect here, as 'close' will fire immediately after 'error'
    });
}

/**
 * Implements Exponential Backoff logic for reconnecting.
 */
function triggerCircuitBreakerReconnect() {
    if (currentReconnectDelay > MAX_RECONNECT_DELAY) {
        console.error('🚨 [SYSTEM OUTAGE ALERT] Binance WebSocket is unreachable after multiple attempts!');
        // In a real production app, this would trigger PagerDuty or Slack alerts
        return;
    }

    console.log(`⏱️ [Circuit Breaker] Attempting reconnect in ${currentReconnectDelay / 1000} seconds...`);
    setTimeout(() => {
        startMarketStream();
    }, currentReconnectDelay);

    // Exponentially increase the delay for the next potential failure (1s -> 2s -> 4s -> 8s ...)
    currentReconnectDelay *= 2;
}

module.exports = startMarketStream;