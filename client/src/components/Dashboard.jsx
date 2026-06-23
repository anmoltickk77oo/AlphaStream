import React from 'react';
import { useMarketData } from '../hooks/useMarketData';
import { LiveTicker } from './LiveTicker';
import { RiskGauge } from './RiskGauge';
import { SvgChart } from './SvgChart';
import { OrderBook } from './OrderBook';
import { TradePanel } from './TradePanel';

export const Dashboard = () => {
    const { chartData, emaData, volatility, currentPrice, priceDirection, orderBookData } = useMarketData('BTCUSDT');

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', color: '#cdd6f4' }}>
            <header style={{ marginBottom: '30px', borderBottom: '1px solid #313244', paddingBottom: '15px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', color: '#89b4fa' }}>AlphaStream Terminal</h1>
                <p style={{ margin: '5px 0 0 0', color: '#a6adc8', fontSize: '14px' }}>
                    Institutional-Grade Data Pipeline • Thread-Offloaded Analytics
                </p>
            </header>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 250px' }}>
                    <LiveTicker symbol="BTCUSDT" price={currentPrice} direction={priceDirection} />
                </div>
                <div style={{ flex: '1 1 250px' }}>
                    <RiskGauge volatility={volatility} currentPrice={currentPrice} />
                </div>
                <div style={{ flex: '1 1 320px' }}>
                    <TradePanel currentPrice={currentPrice} />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 auto' }}>
                    <SvgChart data={chartData} emaData={emaData} />
                </div>

                <div style={{ flex: '0 0 auto' }}>
                    <OrderBook orderBookData={orderBookData} />
                </div>
            </div>
        </div>
    );
};