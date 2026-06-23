import fs from 'fs';

const p = './src/App.jsx';
let code = fs.readFileSync(p, 'utf8');

// 1. Add imports
code = code.replace(
  'import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";',
  'import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";\nimport { io } from "socket.io-client";\nimport axios from "axios";'
);

// 2. Add state variables inside AlphaStream()
code = code.replace(
  '  const [theme, setTheme] = useState',
  `  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [isStale, setIsStale] = useState(false);
  const [metrics, setMetrics] = useState({ spread: 0, volatility: 0, ema15: null, ema50: null });
  const [showEMA, setShowEMA] = useState(false);
  
  const ema15SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const staleTimerRef = useRef(null);
  const socketRef = useRef(null);

  const [theme, setTheme] = useState`
);

// 3. Remove Main Simulation Loop and replace with WebSocket & Wallet init
const simLoopRegex = /\/\/ Main Simulation Loop \(1200ms\)[\s\S]*?(?=const filteredPairs =)/;

const websocketLogic = `// Backend Integration & WebSockets
  useEffect(() => {
    axios.get("http://localhost:5000/api/wallet")
      .then(res => {
        if (res.data) {
          setWallet(parseFloat(res.data.usd_balance) || 10000);
          setBtcBal(parseFloat(res.data.btc_balance) || 0);
        }
      })
      .catch(console.error);

    const socket = io("http://localhost:5000");
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketStatus("connected");
      setIsStale(false);
    });

    socket.on("disconnect", () => setSocketStatus("disconnected"));

    socket.on("live_price_update", (payload) => {
      clearTimeout(staleTimerRef.current);
      setIsStale(false);
      staleTimerRef.current = setTimeout(() => setIsStale(true), 5000);

      const isCurrentPair = payload.symbol.toLowerCase() === selectedPair.name.replace("/", "").toLowerCase();

      setPairsList(list => list.map(p => {
        if (p.name.replace("/", "").toLowerCase() === payload.symbol.toLowerCase()) {
          const chg = ((payload.price - p.price) / p.price) * 100;
          return { ...p, price: payload.price, change: isNaN(chg) ? 0 : chg };
        }
        return p;
      }));

      if (isCurrentPair) {
        setPrice(prev => {
          setPriceDir(payload.price >= prev ? 1 : -1);
          return payload.price;
        });

        const newPrice = payload.price;
        setTrades(old => {
            const newTrade = {
                id: Math.random().toString(),
                price: newPrice,
                amount: +(Math.random() * 0.2).toFixed(5),
                side: Math.random() > 0.5 ? "buy" : "sell",
                time: new Date().toTimeString().slice(0, 8),
            };
            return [newTrade, ...old].slice(0, 50);
        });

        if (mainSeriesRef.current && volumeSeriesRef.current && chartDataRef.current.candles.length > 0) {
          const { candles, volumes } = chartDataRef.current;
          const lastCandle = candles[candles.length - 1];
          lastCandle.close = newPrice;
          if (newPrice > lastCandle.high) lastCandle.high = newPrice;
          if (newPrice < lastCandle.low) lastCandle.low = newPrice;
          
          const lastVol = volumes[volumes.length - 1];
          lastVol.color = lastCandle.close >= lastCandle.open ? "rgba(14,203,129,0.5)" : "rgba(246,70,93,0.5)";
          lastVol.value += +(Math.random() * 2).toFixed(2);

          const timeStr = Math.floor(Date.now() / 1000);
          lastCandle.time = timeStr;
          lastVol.time = timeStr;

          const updateObj = { time: lastCandle.time, open: lastCandle.open, high: lastCandle.high, low: lastCandle.low, close: lastCandle.close };
          const lineObj = { time: lastCandle.time, value: lastCandle.close };
          
          if (chartType === "Bars" || chartType.toLowerCase().includes("candles")) {
            mainSeriesRef.current.update(updateObj);
          } else if (chartType === "HLC area") {
            mainSeriesRef.current.update(lineObj);
            if (extraSeriesRefs.current.length >= 2) {
              extraSeriesRefs.current[0].update({ time: lastCandle.time, value: lastCandle.high });
              extraSeriesRefs.current[1].update({ time: lastCandle.time, value: lastCandle.low });
            }
          } else {
            mainSeriesRef.current.update(lineObj);
          }
          volumeSeriesRef.current.update(lastVol);
        }
      }
    });

    socket.on("live_order_book", (payload) => {
      if (payload.symbol.toLowerCase() === selectedPair.name.replace("/", "").toLowerCase()) {
        let askTotal = 0;
        const asks = payload.asks.slice(0, 16).map(a => {
            askTotal += a.quantity;
            return { price: a.price, amount: a.quantity, total: askTotal };
        }).reverse();

        let bidTotal = 0;
        const bids = payload.bids.slice(0, 16).map(b => {
            bidTotal += b.quantity;
            return { price: b.price, amount: b.quantity, total: bidTotal };
        });

        setOrderBook({ asks, bids });
      }
    });

    socket.on("live_metrics_update", (payload) => {
      if (payload.symbol.toLowerCase() === selectedPair.name.replace("/", "").toLowerCase()) {
        setMetrics(payload);
        const timeStr = Math.floor(Date.now() / 1000);
        if (showEMA) {
            if (ema15SeriesRef.current && payload.ema15) ema15SeriesRef.current.update({ time: timeStr, value: payload.ema15 });
            if (ema50SeriesRef.current && payload.ema50) ema50SeriesRef.current.update({ time: timeStr, value: payload.ema50 });
        }
      }
    });

    return () => {
      socket.disconnect();
      clearTimeout(staleTimerRef.current);
    };
  }, [selectedPair.name, chartType, showEMA]);

  `;

code = code.replace(simLoopRegex, websocketLogic);

// 4. Update the chart applyOptions effect to add EMA
const chartSetupRegex = /const { candles, volumes } = chartDataRef\.current;[\s\S]*?(?=let mainSeries;)/;
const chartSetupReplace = `const { candles, volumes } = chartDataRef.current;
    if (!candles.length) return;

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(volumes);
    }

    if (showEMA) {
        ema15SeriesRef.current = chart.addLineSeries({ color: '#c2a1ff', lineWidth: 1.5 });
        ema50SeriesRef.current = chart.addLineSeries({ color: '#ff6838', lineWidth: 1.5 });
        extraSeriesRefs.current.push(ema15SeriesRef.current, ema50SeriesRef.current);
    }

    const up = '#0ecb81';
    const down = '#f6465d';
    const lineColor = theme === 'light' ? '#1e2329' : '#eaecef';
    const faintColor = theme === 'light' ? 'rgba(112,122,138,0.5)' : 'rgba(132,142,156,0.5)';

    `;

code = code.replace(chartSetupRegex, chartSetupReplace);

// 5. Update MA Indicators Row to EMA Toggle
code = code.replace(
  /<div style={{ height: "26px", flexShrink: 0, display: "flex", alignItems: "center", gap: "16px", padding: "0 16px" }}>[\s\S]*?<\/div>/,
  `<div style={{ height: "26px", flexShrink: 0, display: "flex", alignItems: "center", gap: "16px", padding: "0 16px" }}>
              <div onClick={() => setShowEMA(!showEMA)} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", background: showEMA ? "var(--bg-secondary)" : "transparent", padding: "2px 8px", borderRadius: "4px", border: showEMA ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
                <span className="mono" style={{ fontSize: "12px", fontWeight: 600, color: showEMA ? "var(--accent)" : "var(--text-secondary)" }}>EMA 15/50</span>
              </div>
              <div style={{ display: "flex", gap: "16px", marginLeft: "auto" }}>
                <span className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Spread: <span style={{ color: "var(--text-primary)" }}>{metrics.spread ? metrics.spread.toFixed(2) : '-'}</span></span>
                <span className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Vol: <span style={{ color: "var(--text-primary)" }}>{metrics.volatility ? metrics.volatility.toFixed(4) : '-'}</span></span>
              </div>
            </div>`
);

// 6. Update Status Bar
code = code.replace(
  /<span style={{ color: "#0ecb81", flexShrink: 0 }}>● LIVE WEBSOCKET CONNECTED<\/span>/,
  `<span style={{ color: socketStatus === 'connected' ? "#0ecb81" : "#f6465d", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: socketStatus === 'connected' ? "#0ecb81" : "#f6465d" }}></span>
            {socketStatus === 'connected' ? "LIVE WEBSOCKET CONNECTED" : "WEBSOCKET DISCONNECTED"}
          </span>`
);

// 7. Update Buy/Sell API calls
code = code.replace(
  /const handleBuy = useCallback\(\(\) => \{[\s\S]*?\}, \[buyAmt, buyPrice, wallet\]\);/,
  `const handleBuy = useCallback(async () => {
    setBuyError(""); setBuyFlash("");
    const p = parseFloat(buyPrice);
    const a = parseFloat(buyAmt);
    if (isNaN(a) || a <= 0 || isNaN(p) || p <= 0) {
      setBuyError("Invalid amount"); return;
    }
    const cost = p * a;
    if (cost > wallet) {
      setBuyError("Insufficient USDT"); return;
    }
    try {
        const res = await axios.post("http://localhost:5000/api/trade", {
            symbol: selectedPair.name.replace("/", ""),
            side: "BUY",
            amountUSD: cost
        });
        if (res.data.status === 'SUCCESS' && res.data.newBalances) {
            setWallet(parseFloat(res.data.newBalances.usd_balance));
            setBtcBal(parseFloat(res.data.newBalances.btc_balance));
        } else {
            // Simulated trade update fallback
            setWallet(w => +(w - cost).toFixed(2));
            setBtcBal(b => +(b + a).toFixed(5));
        }
        setBuyFlash(\`✓ Filled at $\${p}\`);
        setTimeout(() => setBuyFlash(""), 2000);
    } catch (err) {
        setBuyError(err.response?.data?.error || "Trade failed");
    }
  }, [buyAmt, buyPrice, wallet, selectedPair.name]);`
);

code = code.replace(
  /const handleSell = useCallback\(\(\) => \{[\s\S]*?\}, \[buyAmt, buyPrice, btcBal\]\);/,
  `const handleSell = useCallback(async () => {
    setSellError(""); setSellFlash("");
    const p = parseFloat(buyPrice);
    const a = parseFloat(buyAmt);
    if (isNaN(a) || a <= 0 || isNaN(p) || p <= 0) {
      setSellError("Invalid amount"); return;
    }
    if (a > btcBal) {
      setSellError("Insufficient BTC"); return;
    }
    const cost = p * a;
    try {
        const res = await axios.post("http://localhost:5000/api/trade", {
            symbol: selectedPair.name.replace("/", ""),
            side: "SELL",
            amountUSD: cost
        });
        if (res.data.status === 'SUCCESS' && res.data.newBalances) {
            setWallet(parseFloat(res.data.newBalances.usd_balance));
            setBtcBal(parseFloat(res.data.newBalances.btc_balance));
        } else {
            // Simulated trade update fallback
            setBtcBal(b => +(b - a).toFixed(5));
            setWallet(w => +(w + cost).toFixed(2));
        }
        setSellFlash(\`✓ Sold at $\${p}\`);
        setTimeout(() => setSellFlash(""), 2000);
    } catch (err) {
        setSellError(err.response?.data?.error || "Trade failed");
    }
  }, [buyAmt, buyPrice, btcBal, selectedPair.name]);`
);

// 8. Add Overlay Warning
code = code.replace(
  '{/* ROW 1: Ticker Bar */}',
  `{isStale && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(246,70,93,0.9)", color: "#fff", padding: "16px 24px", borderRadius: "8px", zIndex: 1000, fontWeight: 700, fontSize: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", gap: "10px" }}>
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>
            STALE DATA WARNING
          </div>
        )}
        
        {/* ROW 1: Ticker Bar */}`
);

fs.writeFileSync(p, code);
console.log('App.jsx patched');
