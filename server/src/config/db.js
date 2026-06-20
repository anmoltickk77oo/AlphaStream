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
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};