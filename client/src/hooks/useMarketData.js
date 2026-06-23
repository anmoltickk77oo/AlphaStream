import { useState, useEffect, useRef } from 'react';
import { socket } from '../services/socketClient';
// Vite syntax for importing a WebWorker
import MathWorker from '../workers/mathWorker?worker';

export const useMarketData = (symbol) => {
    const [chartData, setChartData] = useState([]);
    const [emaData, setEmaData] = useState([]);
    const [volatility, setVolatility] = useState(0);
    const [currentPrice, setCurrentPrice] = useState(null);
    const [orderBookData, setOrderBookData] = useState(null);

    const workerRef = useRef(null);

    useEffect(() => {
        // 1. Initialize the WebWorker
        workerRef.current = new MathWorker();

        // 2. Listen for the calculated results from the background thread
        workerRef.current.onmessage = (e) => {
            setEmaData(e.data.ema);
            setVolatility(e.data.volatility);
        };

        // 3. Listen to the Redis/Socket.IO Pipeline
        socket.on('live_price_update', (data) => {
            if (data.symbol !== symbol) return;

            const newPrice = parseFloat(data.price);
            setCurrentPrice(newPrice);

            setChartData((prevData) => {
                const updated = [...prevData, { time: data.timestamp, price: newPrice }];
                // Keep the last 100 points for a smooth visual window
                if (updated.length > 100) updated.shift();

                // Fire the array to the WebWorker for heavy math processing
                const priceArray = updated.map(d => d.price);
                workerRef.current.postMessage({ prices: priceArray });

                return updated;
            });
        });

        // 4. Listen to the Order Book Stream
        socket.on('live_order_book', (data) => {
            if (data.symbol !== symbol) return;
            setOrderBookData({ bids: data.bids, asks: data.asks });
        });

        return () => {
            socket.off('live_price_update');
            socket.off('live_order_book');
            workerRef.current.terminate(); // Clean up worker on unmount
        };
    }, [symbol]);

    return { chartData, emaData, volatility, currentPrice, orderBookData };
};