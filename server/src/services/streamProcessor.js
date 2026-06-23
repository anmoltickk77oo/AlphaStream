class StreamProcessor {
    constructor() {
        // State per symbol
        this.state = {};
    }

    _initSymbol(symbol) {
        if (!this.state[symbol]) {
            this.state[symbol] = {
                prices: [], // rolling buffer of up to 50 prices
                spread: 0,
                volatility: 0,
                ema15: null,
                ema50: null
            };
        }
    }

    /**
     * Process a new trade tick and calculate Volatility and EMAs
     */
    processTrade(symbol, price) {
        this._initSymbol(symbol);
        const s = this.state[symbol];

        // 1. Maintain rolling price buffer (max 50)
        s.prices.push(price);
        if (s.prices.length > 50) {
            s.prices.shift();
        }

        // 2. Calculate Volatility (Standard Deviation of rolling buffer)
        if (s.prices.length > 1) {
            const mean = s.prices.reduce((a, b) => a + b, 0) / s.prices.length;
            const variance = s.prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / s.prices.length;
            s.volatility = Math.sqrt(variance);
        }

        // 3. Calculate EMAs
        s.ema15 = this._calculateEMA(price, s.ema15, 15, s.prices);
        s.ema50 = this._calculateEMA(price, s.ema50, 50, s.prices);
    }

    /**
     * Process order book depth and calculate Spread
     */
    processDepth(symbol, bids, asks) {
        this._initSymbol(symbol);
        const s = this.state[symbol];

        if (bids.length > 0 && asks.length > 0) {
            // Find max bid and min ask
            let maxBid = -Infinity;
            for (let b of bids) {
                if (b.price > maxBid) maxBid = b.price;
            }

            let minAsk = Infinity;
            for (let a of asks) {
                if (a.price < minAsk) minAsk = a.price;
            }

            if (minAsk !== Infinity && maxBid !== -Infinity && minAsk > maxBid) {
                s.spread = minAsk - maxBid;
            }
        }
    }

    /**
     * Get the current computed metrics for a symbol
     */
    getMetrics(symbol) {
        if (!this.state[symbol]) return null;
        return {
            symbol: symbol,
            spread: this.state[symbol].spread,
            volatility: this.state[symbol].volatility,
            ema15: this.state[symbol].ema15,
            ema50: this.state[symbol].ema50
        };
    }

    /**
     * Helper to calculate EMA iteratively
     */
    _calculateEMA(currentPrice, prevEMA, period, priceBuffer) {
        // If we don't have a previous EMA, and we have enough prices to calculate a seed SMA
        if (prevEMA === null) {
            if (priceBuffer.length >= period) {
                // Seed with SMA of the last 'period' elements
                const subset = priceBuffer.slice(-period);
                const sma = subset.reduce((a, b) => a + b, 0) / period;
                return sma;
            } else {
                return null; // Not enough data yet
            }
        }

        // We have a prevEMA, so apply the multiplier
        const multiplier = 2 / (period + 1);
        return (currentPrice - prevEMA) * multiplier + prevEMA;
    }
}

module.exports = new StreamProcessor();
