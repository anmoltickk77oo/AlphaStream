require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const WebSocket = require('ws');
const Redis = require('ioredis');

const pairs = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt', 'dogeusdt', 'xrpusdt', 'adausdt', 'avaxusdt', 'linkusdt', 'dotusdt'];
const tradeStreams = pairs.map(p => `${p}@trade`).join('/');
const depthStreams = pairs.map(p => `${p}@depth10@1000ms`).join('/');

const TRADE_WS_URL = `wss://stream.binance.com:9443/stream?streams=${tradeStreams}`;
const DEPTH_WS_URL = `wss://stream.binance.com:9443/stream?streams=${depthStreams}`;

const REDIS_TRADE_CHANNEL = 'MARKET_DATA';
const REDIS_DEPTH_CHANNEL = 'ORDER_BOOK';

const redisPublisher = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null
});

redisPublisher.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
});

// Circuit Breaker State
// Circuit Breaker Config
const MAX_RECONNECT_ATTEMPTS = 5;
const REDIS_OUTAGE_KEY = 'SYSTEM_OUTAGE';
const REDIS_STATUS_CHANNEL = 'SYSTEM_STATUS';

// State registries
let reconnectAttempts = 0;
const lastPublishTimes = {}; // For throttling

function initIngestionPipeline() {
    console.log('📡 Initializing connections to external exchange feeds...');

    // Clear outage status on a fresh pipeline initialization
    redisPublisher.set(REDIS_OUTAGE_KEY, 'false');
    redisPublisher.publish(REDIS_STATUS_CHANNEL, JSON.stringify({ status: 'HEALTHY' }));

    // --- 1. THE PRICE STREAM ---
    let tradeWs = new WebSocket(TRADE_WS_URL);
    tradeWs.on('open', () => {
        console.log('🔗 Trade Stream Connected');
        reconnectAttempts = 0; // Reset count on success
        redisPublisher.set(REDIS_OUTAGE_KEY, 'false');
        redisPublisher.publish(REDIS_STATUS_CHANNEL, JSON.stringify({ status: 'HEALTHY' }));
    });
    tradeWs.on('message', (data) => {
        try {
            const parsed = JSON.parse(data);
            if (!parsed.data) return;
            const trade = parsed.data;
            const symbol = trade.s;
            const now = Date.now();

            // Throttle to 5 updates per second per symbol (200ms window)
            if (now - (lastPublishTimes[symbol] || 0) >= 200) {
                lastPublishTimes[symbol] = now;
                const payload = JSON.stringify({
                    symbol: symbol,
                    price: parseFloat(trade.p),
                    timestamp: trade.E
                });
                redisPublisher.publish(REDIS_TRADE_CHANNEL, payload);
            }
        } catch (error) { /* Ignore malformed packets */ }
    });
    tradeWs.on('close', () => {
        console.warn('⚠️ Trade Stream disconnected.');
        triggerBackoffLoop();
    });
    tradeWs.on('error', () => tradeWs.close());

    // --- 2. THE ORDER BOOK STREAM ---
    let depthWs = new WebSocket(DEPTH_WS_URL);
    depthWs.on('open', () => {
        console.log('📚 Order Book Stream Connected');
        reconnectAttempts = 0; // Reset count on success
    });
    depthWs.on('message', (data) => {
        try {
            const parsed = JSON.parse(data);
            if (!parsed.data) return;
            const depth = parsed.data;
            const symbol = parsed.stream.split('@')[0].toUpperCase();

            // Binance sends arrays of strings: ["price", "quantity"]. We map them to clean floats.
            const payload = JSON.stringify({
                symbol: symbol,
                bids: depth.bids.map(b => ({ price: parseFloat(b[0]), quantity: parseFloat(b[1]) })),
                asks: depth.asks.map(a => ({ price: parseFloat(a[0]), quantity: parseFloat(a[1]) }))
            });

            redisPublisher.publish(REDIS_DEPTH_CHANNEL, payload);
        } catch (error) { /* Ignore */ }
    });
    depthWs.on('close', () => {
        console.warn('⚠️ Order Book Stream disconnected.');
        triggerBackoffLoop();
    });
    depthWs.on('error', () => depthWs.close());
}

let isReconnecting = false;

function triggerBackoffLoop() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`🚨 [SYSTEM OUTAGE ALERT] Binance WebSocket is unreachable after ${reconnectAttempts} attempts!`);
        redisPublisher.set(REDIS_OUTAGE_KEY, 'true');
        redisPublisher.publish(REDIS_STATUS_CHANNEL, JSON.stringify({ status: 'OUTAGE' }));
        return;
    }

    if (isReconnecting) return;
    isReconnecting = true;

    let backoff = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts));
    const finalDelay = backoff + Math.floor(Math.random() * 500);

    console.warn(`🔄 Attempting pipeline link reset in ${finalDelay}ms (Retry: ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    setTimeout(() => {
        reconnectAttempts++;
        isReconnecting = false;
        initIngestionPipeline();
    }, finalDelay);
}

initIngestionPipeline();