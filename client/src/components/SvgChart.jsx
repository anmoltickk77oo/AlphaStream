import React, { useMemo } from 'react';

export const SvgChart = ({ data, emaData }) => {
    const width = 800;
    const height = 300;
    const padding = 20;

    // UseMemo ensures we only recalculate the path strings when the data actually changes
    const { pricePath, emaPath, minPrice, maxPrice } = useMemo(() => {
        if (!data || data.length === 0) return { pricePath: '', emaPath: '' };

        const prices = data.map(d => d.price);
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const priceRange = maxP - minP || 1; // Prevent divide by zero

        // Function to map a data point to X,Y coordinates on the SVG canvas
        const getCoordinates = (val, index, total) => {
            const x = padding + (index / (total - 1)) * (width - padding * 2);
            // Invert Y because SVG coordinates start at the top left (0,0)
            const y = height - padding - ((val - minP) / priceRange) * (height - padding * 2);
            return `${x},${y}`;
        };

        // Generate the exact SVG path string (M = Move to, L = Line to)
        const pricePathString = prices.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${getCoordinates(p, i, prices.length)}`
        ).join(' ');

        let emaPathString = '';
        if (emaData && emaData.length > 0) {
            emaPathString = emaData.map((e, i) =>
                `${i === 0 ? 'M' : 'L'} ${getCoordinates(e, i, emaData.length)}`
            ).join(' ');
        }

        return { pricePath: pricePathString, emaPath: emaPathString, minPrice: minP, maxPrice: maxP };
    }, [data, emaData]);

    return (
        <div style={{ background: '#1e1e2e', borderRadius: '8px', padding: '20px', width: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a6adc8', fontSize: '12px', marginBottom: '10px' }}>
                <span>High: ${maxPrice?.toFixed(2)}</span>
                <span>Low: ${minPrice?.toFixed(2)}</span>
            </div>

            <svg width={width} height={height} style={{ border: '1px solid #313244', borderRadius: '4px' }}>
                {/* Grid Lines */}
                <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#313244" strokeDasharray="4" />

                {/* The EMA Overlay (Smooth Orange Line) */}
                {emaPath && <path d={emaPath} fill="none" stroke="#fab387" strokeWidth="2" opacity="0.8" />}

                {/* The Raw Price Data (Sharp Blue Line) */}
                <path d={pricePath} fill="none" stroke="#89b4fa" strokeWidth="2" />
            </svg>

            <div style={{ display: 'flex', gap: '15px', marginTop: '10px', fontSize: '12px' }}>
                <div style={{ color: '#89b4fa' }}>— Raw Price</div>
                <div style={{ color: '#fab387' }}>— 10-Period EMA</div>
            </div>
        </div>
    );
};