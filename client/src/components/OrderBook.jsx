import React from 'react';

export const OrderBook = ({ orderBookData }) => {
    if (!orderBookData || (!orderBookData.bids && !orderBookData.asks)) {
        return (
            <div style={{ background: '#181825', border: '1px dashed #45475a', padding: '40px', textAlign: 'center', borderRadius: '8px', color: '#585b70' }}>
                Waiting for Order Book Stream...
            </div>
        );
    }

    const { bids, asks } = orderBookData;

    // Helper to render a row
    const renderRow = (item, type) => {
        const color = type === 'bid' ? '#22c55e' : '#ef4444'; // Green for Bids, Red for Asks
        const barWidth = Math.min((item.quantity / 5) * 100, 100); // Simple visual scaling

        return (
            <div key={item.price} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', position: 'relative', overflow: 'hidden' }}>
                {/* Visual Depth Bar */}
                <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    right: type === 'bid' ? 0 : 'auto', 
                    left: type === 'ask' ? 0 : 'auto', 
                    bottom: 0, 
                    width: `${barWidth}%`, 
                    backgroundColor: color, 
                    opacity: 0.15 
                }} />
                
                <span style={{ color }}>${item.price.toFixed(2)}</span>
                <span style={{ color: '#a6adc8' }}>{item.quantity.toFixed(4)}</span>
            </div>
        );
    };

    return (
        <div style={{ background: '#1e1e2e', padding: '20px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#89b4fa', fontSize: '16px' }}>Live Order Book Depth</h3>
            <div style={{ display: 'flex', gap: '20px' }}>
                {/* BIDS (Buyers) */}
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6c7086', fontSize: '12px', marginBottom: '8px', borderBottom: '1px solid #313244', paddingBottom: '4px' }}>
                        <span>Bid Price</span>
                        <span>Quantity</span>
                    </div>
                    {bids && bids.slice(0, 10).map(bid => renderRow(bid, 'bid'))}
                </div>

                {/* ASKS (Sellers) */}
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6c7086', fontSize: '12px', marginBottom: '8px', borderBottom: '1px solid #313244', paddingBottom: '4px' }}>
                        <span>Ask Price</span>
                        <span>Quantity</span>
                    </div>
                    {asks && asks.slice(0, 10).map(ask => renderRow(ask, 'ask'))}
                </div>
            </div>
        </div>
    );
};