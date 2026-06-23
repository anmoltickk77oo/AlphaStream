// server/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

console.log('--- FORCED OVERRIDE DATABASE CONNECTION CONFIG ---');
console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
console.log(`Port: ${process.env.DB_PORT || 5433}`);
console.log(`User: ${process.env.DB_USER || 'admin'}`);
console.log(`Database: ${process.env.DB_NAME || 'alphastream'}`);
console.log('--------------------------------------------------');

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'alphastream',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
    console.error('⚠️ PostgreSQL connection error (is Docker running?):', err.message);
    // process.exit(-1); // Disabled to allow server to run without DB for now
});

module.exports = pool;