import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    timeout: 5000,
});

/**
 * Fetches the historical ledger snapshots for a specific asset.
 * @param {string} symbol - The trading pair (e.g., 'BTCUSDT')
 */
export const fetchPriceHistory = async (symbol) => {
    try {
        const response = await API.get(`/api/history/${symbol}`);
        return response.data; // Array of { id, symbol, price, recorded_at }
    } catch (error) {
        console.error(`❌ Error fetching history for ${symbol}:`, error);
        throw error;
    }
};