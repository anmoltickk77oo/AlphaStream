require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const Ledger = require('./models/Ledger');
const startMarketStream = require('./services/exchangeStream'); // <-- IMPORT ADDED

// Initialize App
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS for the Vite frontend
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize Database Schema on Boot
Ledger.initializeSchema();

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

io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket server actively listening`);

    // START THE INGESTION PIPELINE <-- EXECUTION ADDED
    startMarketStream(io);
});