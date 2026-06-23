import React, { useState } from 'react';

export const TradePanel = ({ currentPrice }) => {
    const [amountUSD, setAmountUSD] = useState(1000);
    const [balances, setBalances] = useState({ usd: 10000.00, btc: 0.00 });
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const executeTrade = async (side) => {
        if (!currentPrice) {
            setStatus('Error: Waiting for live price...');
            return;
        }

        setLoading(true);
        setStatus(`Routing ${side} order...`);

        try {
            const response = await fetch('http://localhost:5000/api/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ side, amountUSD: Number(amountUSD) })
            });

            const result = await response.json();

            if (response.ok) {
                setBalances({
                    usd: parseFloat(result.newBalances.usd_balance),
                    btc: parseFloat(result.newBalances.btc_balance)
                });
                setStatus(`✅ Filled at $${result.executionPrice}`);
            } else {
                setStatus(`❌ ${result.error}`);
            }
        } catch (error) {
            setStatus('❌ Network error communicating with execution engine');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ background: '#1e1e2e', padding: '20px', borderRadius: '8px', minWidth: '320px', border: '1px solid #313244' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <span style={{ color: '#a6adc8', fontSize: '14px', fontWeight: 'bold' }}>Simulated Wallet</span>
                <span style={{ color: '#89b4fa', fontSize: '14px' }}>
                    ${balances.usd.toFixed(2)} | {balances.btc.toFixed(4)} BTC
                </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#181825', borderRadius: '4px', padding: '5px 10px', flex: 1, border: '1px solid #45475a' }}>
                    <span style={{ color: '#a6adc8', marginRight: '5px' }}>$</span>
                    <input 
                        type="number" 
                        value={amountUSD} 
                        onChange={(e) => setAmountUSD(e.target.value)}
                        style={{ background: 'transparent', border: 'none', color: '#cdd6f4', width: '100%', outline: 'none', fontSize: '16px' }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <button 
                    onClick={() => executeTrade('BUY')}
                    disabled={loading}
                    style={{ flex: 1, padding: '10px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                    BUY BTC
                </button>
                <button 
                    onClick={() => executeTrade('SELL')}
                    disabled={loading}
                    style={{ flex: 1, padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                    SELL BTC
                </button>
            </div>

            <div style={{ fontSize: '12px', color: status.includes('❌') ? '#ef4444' : '#a6adc8', textAlign: 'center', minHeight: '16px' }}>
                {status}
            </div>
        </div>
    );
};
