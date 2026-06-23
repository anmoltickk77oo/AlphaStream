/**
 * Calculates a standard Exponential Moving Average (EMA)
 */
export function calculateEMA(prices, period) {
    if (prices.length === 0) return [];

    const k = 2 / (period + 1);
    let emaArray = [];

    // Start the EMA with the first price
    let currentEMA = prices[0];
    emaArray.push(currentEMA);

    for (let i = 1; i < prices.length; i++) {
        currentEMA = (prices[i] - currentEMA) * k + currentEMA;
        emaArray.push(currentEMA);
    }
    return emaArray;
}

/**
 * Calculates the Standard Deviation (Volatility) of a price array
 */
export function calculateVolatility(prices) {
    if (prices.length < 2) return 0;

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / prices.length;
    return Math.sqrt(variance);
}

// Listen for messages from the main React thread (only if running inside browser WebWorker)
if (typeof self !== 'undefined') {
    self.onmessage = function (e) {
        const { prices } = e.data;

        // We calculate a fast 10-period EMA
        const ema = calculateEMA(prices, 10);
        const volatility = calculateVolatility(prices);

        // Send the calculated data back to React
        self.postMessage({ ema, volatility });
    };
}