import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const PriceChart = ({ data }) => {
    return (
        <div style={{ width: '100%', height: '400px', background: '#1e1e2e', padding: '20px', borderRadius: '8px', boxSizing: 'border-box' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
                    <XAxis
                        dataKey="time"
                        stroke="#cdd6f4"
                        tick={{ fontSize: 11 }}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        stroke="#cdd6f4"
                        tick={{ fontSize: 11 }}
                        width={80}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#181825', borderColor: '#313244', color: '#cdd6f4' }}
                        formatter={(value) => [`$${value.toLocaleString()}`, 'Price']}
                    />
                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#89b4fa"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false} // Turn off animations for high-frequency rendering updates
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};