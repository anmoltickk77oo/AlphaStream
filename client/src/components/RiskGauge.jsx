import React from 'react';

export const RiskGauge = ({ volatility, currentPrice }) => {
    // Calculate volatility as a percentage of the current price
    // (e.g., a $5 swing on a $60,000 asset is tiny, but a $5 swing on a $100 asset is massive)
    const relativeVolatility = currentPrice && currentPrice > 0
        ? (volatility / currentPrice) * 100
        : 0;

    // Determine algorithmic risk thresholds
    let riskLabel = 'Calm';
    let indicatorColor = '#22c55e'; // Green

    if (relativeVolatility > 0.1) {
        riskLabel = 'Extreme';
        indicatorColor = '#ef4444'; // Red
    } else if (relativeVolatility > 0.03) {
        riskLabel = 'Elevated';
        indicatorColor = '#f59e0b'; // Orange
    }

    return (
        <div style={{
            background: '#1e1e2e',
            padding: '15px 20px',
            borderRadius: '8px',
            minWidth: '200px',
            borderLeft: `4px solid ${indicatorColor}`
        }}>
            <div style={{ color: '#a6adc8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                10-Tick Volatility Index
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#cdd6f4' }}>
                    ±${volatility.toFixed(2)}
                </span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: indicatorColor }}>
                    {riskLabel}
                </span>
            </div>
        </div>
    );
};