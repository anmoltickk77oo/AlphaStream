import React from 'react';

export const LiveTicker = ({ symbol, price, direction }) => {
    // Determine CSS or inline styles based on directional changes
    const getDirectionStyle = () => {
        if (direction === 'up') return { color: '#22c55e', transition: 'color 0.2s ease' }; // Green
        if (direction === 'down') return { color: '#ef4444', transition: 'color 0.2s ease' }; // Red
        return { color: '#ffffff' };
    };

    return (
        <div style={{ padding: '20px', background: '#1e1e2e', borderRadius: '8px', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#a6adc8', fontSize: '14px', letterSpacing: '1px' }}>
                {symbol.toUpperCase()} / USDT
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px', marginTop: '5px' }}>
                <span style={{ fontSize: '32px', fontWeight: 'bold', ...getDirectionStyle() }}>
                    {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Connecting...'}
                </span>
                {direction !== 'neutral' && (
                    <span style={{ fontSize: '18px', fontWeight: '600', color: direction === 'up' ? '#22c55e' : '#ef4444' }}>
                        {direction === 'up' ? '▲' : '▼'}
                    </span>
                )}
            </div>
        </div>
    );
};