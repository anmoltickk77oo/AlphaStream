import React from 'react';
import { useMarketData } from '../hooks/useMarketData';
import { LiveTicker } from './LiveTicker';
import { PriceChart } from './PriceChart';

export const Dashboard = () => {
    // Hook handles fetching the database foundation and mounting the live stream seamlessly
    const { chartData, currentPrice, priceDirection } = useMarketData('BTCUSDT');

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', color: '#cdd6f4' }}>
            <header style={{ marginBottom: '30px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', color: '#f5c2e7' }}>AlphaStream Terminal</h1>
                <p style={{ margin: '5px 0 0 0', color: '#a6adc8' }}>Real-Time Financial WebSocket Ingestion Engine</p>
            </header>

            <LiveTicker symbol="BTCUSDT" price={currentPrice} direction={priceDirection} />
            <PriceChart data={chartData} />
        </div>
    );
};