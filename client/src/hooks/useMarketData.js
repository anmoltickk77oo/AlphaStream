import { useState, useEffect, useRef } from 'react';
import { fetchPriceHistory } from '../services/api';
import { socket } from '../services/socketClient';

export const useMarketData = (symbol) => {
    const [chartData, setChartData] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(null);
    const [priceDirection, setPriceDirection] = useState('neutral'); // 'up' | 'down' | 'neutral'

    // Use a ref to keep track of the absolute latest price for comparison
    const lastPriceRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        // 1. Fetch initial historical ledger data from PostgreSQL
        const loadInitialData = async () => {
            try {
                const history = await fetchPriceHistory(symbol);
                if (isMounted) {
                    // Map the DB schema to values Recharts easily digests
                    const formattedHistory = history.map(item => ({
                        time: new Date(item.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        price: parseFloat(item.price)
                    }));
                    setChartData(formattedHistory);

                    if (formattedHistory.length > 0) {
                        const lastItemPrice = formattedHistory[formattedHistory.length - 1].price;
                        setCurrentPrice(lastItemPrice);
                        lastPriceRef.current = lastItemPrice;
                    }
                }
            } catch (error) {
                console.error("Failed to load chart history base:", error);
            }
        };

        loadInitialData();

        // 2. Listen to the real-time engine bridge
        socket.on('live_price_update', (data) => {
            if (!isMounted || data.symbol !== symbol) return;

            const newPrice = parseFloat(data.price);
            const formattedTime = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            // Determine directional color formatting (Green vs Red)
            if (lastPriceRef.current !== null) {
                if (newPrice > lastPriceRef.current) setPriceDirection('up');
                else if (newPrice < lastPriceRef.current) setPriceDirection('down');
            }

            setCurrentPrice(newPrice);
            lastPriceRef.current = newPrice;

            // Update chart data stream array, bounding it to maximum 50 elements to keep UI snappy
            setChartData((prevData) => {
                const updated = [...prevData, { time: formattedTime, price: newPrice }];
                if (updated.length > 50) {
                    updated.shift(); // Evict the oldest data point
                }
                return updated;
            });
        });

        // Cleanup connections and listeners on component unmount
        return () => {
            isMounted = false;
            socket.off('live_price_update');
        };
    }, [symbol]);

    return { chartData, currentPrice, priceDirection };
};