require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const Redis = require('ioredis');
const Ledger = require('./models/Ledger');
const Wallet = require('./models/Wallet');
const streamProcessor = require('./services/streamProcessor');

// Initialize Express App
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS for the Vite frontend
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize Database Schema on Boot
Ledger.initializeSchema();
Wallet.initializeSchema();

// ---------------------------------------------------------
// REDIS SUBSCRIBER PIPELINE (Horizontal Scaling Layer)
// ---------------------------------------------------------
const redisSubscriber = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
});

const REDIS_TRADE_CHANNEL = 'MARKET_DATA';
const REDIS_DEPTH_CHANNEL = 'ORDER_BOOK';

// Note: Using 'ready' instead of 'connect' to avoid the ioredis Subscriber Mode crash!
redisSubscriber.on('ready', () => {
    console.log('🧠 Express Server connected to Redis Subscriber (Ready)');

    // Subscribe to BOTH channels
    redisSubscriber.subscribe(REDIS_TRADE_CHANNEL, REDIS_DEPTH_CHANNEL, (err, count) => {
        if (err) {
            console.error('❌ Failed to subscribe to Redis channels:', err);
        } else {
            console.log(`📡 Subscribed successfully to ${count} Redis channel(s)`);
        }
    });
});

// We need a dictionary to hold the absolute latest price for instantaneous order execution for multiple pairs
let latestMarketPrices = {};

// Listen for incoming messages from the Ingestor Worker
redisSubscriber.on('message', (channel, message) => {
    try {
        const payload = JSON.parse(message);
        
        if (channel === REDIS_TRADE_CHANNEL) {
            latestMarketPrices[payload.symbol] = payload.price; // Update our execution cache
            streamProcessor.processTrade(payload.symbol, payload.price);
            // Broadcast the payload instantly to all connected React clients
            io.emit('live_price_update', payload);
            
            const metrics = streamProcessor.getMetrics(payload.symbol);
            if (metrics) io.emit('live_metrics_update', metrics);

        } else if (channel === REDIS_DEPTH_CHANNEL) {
            streamProcessor.processDepth(payload.symbol, payload.bids, payload.asks);
            // Push the 1-second order book snapshot to the UI
            io.emit('live_order_book', payload);
            
            const metrics = streamProcessor.getMetrics(payload.symbol);
            if (metrics) io.emit('live_metrics_update', metrics);
        }
    } catch (error) {
        console.error('❌ Failed to parse Redis message:', error);
    }
});
// ---------------------------------------------------------

// Basic Historical REST Endpoint
app.get('/api/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const history = await Ledger.getHistory(symbol.toUpperCase());
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error fetching ledger history' });
    }
});

// Wallet Balance Endpoint
app.get('/api/wallet', async (req, res) => {
    try {
        const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
        const balances = await Wallet.getBalances(TEST_USER_ID);
        res.status(200).json(balances);
    } catch (error) {
        console.error('❌ Wallet fetch failed:', error.message);
        res.status(500).json({ error: 'Failed to fetch wallet balances' });
    }
});

// ---------------------------------------------------------
// THE TRADING ENGINE ENDPOINT
// ---------------------------------------------------------
app.post('/api/trade', async (req, res) => {
    try {
        const { symbol, side, amountUSD } = req.body;
        
        // Hardcoded test user for MVP purposes
        const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

        const tradeSymbol = symbol ? symbol.toUpperCase() : 'BTCUSDT';
        
        if (tradeSymbol !== 'BTCUSDT') {
            // Frontend requested a non-BTC trade, we return a simulated success as DB doesn't support it yet.
            return res.status(200).json({ status: 'SIMULATED_SUCCESS', message: `Simulated trade for ${tradeSymbol}` });
        }

        const currentExecutionPrice = latestMarketPrices[tradeSymbol];

        if (!currentExecutionPrice) {
            return res.status(503).json({ error: `Market data unavailable for ${tradeSymbol}. Cannot execute trade.` });
        }

        if (!amountUSD || amountUSD <= 0) {
            return res.status(400).json({ error: 'Invalid trade amount' });
        }

        console.log(`⚡ Executing ${side} order for $${amountUSD} at $${currentExecutionPrice}`);

        const result = await Wallet.executeTrade(
            TEST_USER_ID, 
            side.toUpperCase(), 
            parseFloat(amountUSD), 
            currentExecutionPrice
        );

        res.status(200).json(result);

    } catch (error) {
        console.error('❌ Trade Execution Failed:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// --- Historical PostgreSQL Logging ---
// Run an independent loop to insert the price history every 60 seconds
let lastKnownPrice = null;
redisSubscriber.on('message', (channel, message) => {
    if (channel === REDIS_TRADE_CHANNEL) {
        lastKnownPrice = JSON.parse(message);
    }
});

setInterval(async () => {
    if (lastKnownPrice) {
        try {
            await Ledger.insertPrice(lastKnownPrice.symbol, lastKnownPrice.price);
            console.log(`💾 [60s Snapshot] Saved ${lastKnownPrice.symbol} @ $${lastKnownPrice.price}`);
        } catch (error) {
            console.error('❌ Failed to save periodic ledger snapshot:', error);
        }
    }
}, 60000);

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // If we had the circuit breaker state in Redis, we could emit it here
    socket.emit('connection_status', { status: 'Connected' });

    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Express API running on port ${PORT}`);
    console.log(`🌐 Socket.IO actively listening for clients`);
});