import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import MathWorker from './workers/mathWorker?worker';
import { SvgChart } from './components/SvgChart';

function useLightweightCharts() {
  const [lwc, setLwc] = useState(null);
  useEffect(() => {
    if (window.LightweightCharts) {
      setLwc(window.LightweightCharts);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js";
    script.crossOrigin = "anonymous";
    script.async = true;
    script.onload = () => setLwc(window.LightweightCharts);
    document.head.appendChild(script);
  }, []);
  return lwc;
}

const INITIAL_PAIRS = [
  { name: "BTC/USDT", price: 63985.62, change: -0.05 },
  { name: "ETH/USDT", price: 1727.35, change: -0.59 },
  { name: "SOL/USDT", price: 71.78, change: -2.87 },
  { name: "BNB/USDT", price: 592.33, change: 0.09 },
  { name: "DOGE/USDT", price: 0.08203, change: -1.58 },
  { name: "XRP/USDT", price: 0.5231, change: 1.12 },
  { name: "ADA/USDT", price: 0.3841, change: -0.74 },
  { name: "AVAX/USDT", price: 27.44, change: 2.11 },
  { name: "LINK/USDT", price: 11.82, change: -1.33 },
  { name: "DOT/USDT", price: 5.61, change: 0.44 },
];

function generateCandles(basePrice, timeframeMs = 3600000, count = 168) {
  const candles = [];
  const volumes = [];
  let currentPrice = basePrice * 0.95;
  const now = Math.floor(Date.now() / 1000);
  const tfSec = Math.floor(timeframeMs / 1000);
  const alignedNow = Math.floor(now / tfSec) * tfSec;
  let time = alignedNow - ((count - 1) * tfSec);

  for (let i = 0; i < count; i++) {
    const open = currentPrice;
    const change = (Math.random() - 0.48) * currentPrice * 0.01;
    const close = +(open + change).toFixed(2);
    const high = +(Math.max(open, close) + Math.random() * currentPrice * 0.005).toFixed(2);
    const low = +(Math.min(open, close) - Math.random() * currentPrice * 0.005).toFixed(2);
    const vol = +(Math.random() * 100 + 10).toFixed(2);
    
    candles.push({ time, open, high, low, close });
    volumes.push({
      time,
      value: vol,
      color: close >= open ? "rgba(14,203,129,0.5)" : "rgba(246,70,93,0.5)",
    });
    
    currentPrice = close;
    time += tfSec;
  }
  const last = candles[candles.length - 1];
  last.close = basePrice;
  if (basePrice > last.high) last.high = basePrice;
  if (basePrice < last.low) last.low = basePrice;
  volumes[volumes.length - 1].color = last.close >= last.open ? "rgba(14,203,129,0.5)" : "rgba(246,70,93,0.5)";

  return { candles, volumes };
}

function calculateHistoricalEMA(candles, period) {
  if (candles.length < period) return [];
  const emaData = [];
  
  // Calculate seed SMA
  const seedSlice = candles.slice(0, period);
  const sma = seedSlice.reduce((sum, c) => sum + c.close, 0) / period;
  emaData.push({ time: candles[period - 1].time, value: sma });
  
  const multiplier = 2 / (period + 1);
  let prevEMA = sma;
  
  for (let i = period; i < candles.length; i++) {
    const currentPrice = candles[i].close;
    const emaValue = (currentPrice - prevEMA) * multiplier + prevEMA;
    emaData.push({ time: candles[i].time, value: emaValue });
    prevEMA = emaValue;
  }
  
  return emaData;
}

function generateOrderBook(mid) {
  const asks = [];
  const bids = [];
  let askTotal = 0;
  let bidTotal = 0;
  for (let i = 0; i < 16; i++) {
    const spreadAsk = (i + 1) * (mid * 0.0001);
    const amtAsk = +(Math.random() * 2).toFixed(5);
    askTotal += amtAsk;
    asks.push({ price: +(mid + spreadAsk).toFixed(2), amount: amtAsk, total: +askTotal.toFixed(3) });

    const spreadBid = (i + 1) * (mid * 0.0001);
    const amtBid = +(Math.random() * 2).toFixed(5);
    bidTotal += amtBid;
    bids.push({ price: +(mid - spreadBid).toFixed(2), amount: amtBid, total: +bidTotal.toFixed(3) });
  }
  return { asks: asks.reverse(), bids };
}

function generateInitialTrades(mid) {
  const trades = [];
  for (let i = 0; i < 30; i++) {
    const isBuy = Math.random() > 0.5;
    const t = new Date(Date.now() - i * 3000);
    trades.push({
      id: Math.random().toString(),
      price: +(mid + (Math.random() - 0.5) * 5).toFixed(2),
      amount: +(Math.random() * 0.2).toFixed(5),
      side: isBuy ? "buy" : "sell",
      time: t.toTimeString().slice(0, 8),
    });
  }
  return trades;
}

const TIMEFRAMES = [
  { label: "1s", ms: 1000 },
  { label: "15m", ms: 15 * 60000 },
  { label: "1H", ms: 3600000 },
  { label: "4H", ms: 4 * 3600000 },
  { label: "1D", ms: 24 * 3600000 },
  { label: "1W", ms: 7 * 24 * 3600000 },
];

const ICONS = {
  "Bars": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M5 4v10M5 8h3M5 12H2M13 3v12M13 6h3M13 14h-3"/></svg>,
  "Candles": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="4" y="6" width="3" height="6"/><path d="M5.5 3v3m0 6v3"/><rect x="11" y="4" width="3" height="10" fill="currentColor"/><path d="M12.5 1v3m0 10v3"/></svg>,
  "Hollow candles": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="4" y="6" width="3" height="6"/><path d="M5.5 3v3m0 6v3"/><rect x="11" y="4" width="3" height="10"/><path d="M12.5 1v3m0 10v3"/></svg>,
  "Volume candles": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="3" y="6" width="5" height="6" fill="currentColor"/><path d="M5.5 3v3m0 6v3"/><rect x="12" y="4" width="1" height="10" fill="currentColor"/><path d="M12.5 1v3m0 10v3"/></svg>,
  "Line": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"><path d="M2 14 l4 -6 l4 4 l6 -9"/></svg>,
  "Line with markers": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"><path d="M2 14 l4 -6 l4 4 l6 -9"/><circle cx="6" cy="8" r="1.5" fill="currentColor"/><circle cx="10" cy="12" r="1.5" fill="currentColor"/><circle cx="16" cy="3" r="1.5" fill="currentColor"/></svg>,
  "Step line": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"><path d="M2 14 h4 v-6 h4 v4 h6 v-9 h2"/></svg>,
  "Area": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M2 14 l4 -6 l4 4 l6 -9 v15 h-14 z" stroke="none" fill="currentColor" opacity="0.3"/><path d="M2 14 l4 -6 l4 4 l6 -9" fill="none"/></svg>,
  "HLC area": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"><path d="M2 14 l4 -6 l4 4 l6 -9"/><path d="M2 12 l4 -7 l4 5 l6 -10" strokeWidth="0.5" opacity="0.5"/><path d="M2 16 l4 -5 l4 3 l6 -8" strokeWidth="0.5" opacity="0.5"/></svg>,
  "Baseline": <svg viewBox="0 0 18 18" width="18" height="18" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"><path d="M1 9 h16" strokeDasharray="2 2" strokeOpacity="0.5"/><path d="M2 14 l4 -6 l4 4 l6 -9"/></svg>,
};

const CHART_GROUPS = [
  { label: "Candle variants", items: ["Bars", "Candles", "Hollow candles", "Volume candles"] },
  { label: "Line variants", items: ["Line", "Line with markers", "Step line"] },
  { label: "Area variants", items: ["Area", "HLC area", "Baseline"] }
];

function aggregateOrderBook(bids, asks, currentPrice) {
  if (!currentPrice || currentPrice <= 0 || !bids || !asks) return { bids: [], asks: [] };

  const bucketSizePercent = 0.001; // 0.1% of current price
  
  // Initialize 10 ask buckets (ascending from current price)
  const askBuckets = Array.from({ length: 10 }, (_, i) => {
    const lowerBound = currentPrice * (1 + i * bucketSizePercent);
    const upperBound = currentPrice * (1 + (i + 1) * bucketSizePercent);
    return {
      price: (lowerBound + upperBound) / 2, // midpoint
      amount: 0,
      total: 0
    };
  });

  // Initialize 10 bid buckets (descending from current price)
  const bidBuckets = Array.from({ length: 10 }, (_, i) => {
    const upperBound = currentPrice * (1 - i * bucketSizePercent);
    const lowerBound = currentPrice * (1 - (i + 1) * bucketSizePercent);
    return {
      price: (lowerBound + upperBound) / 2, // midpoint
      amount: 0,
      total: 0
    };
  });

  // Populate asks
  for (const ask of asks) {
    const diff = (ask.price - currentPrice) / currentPrice;
    if (diff >= 0) {
      const bucketIndex = Math.floor(diff / bucketSizePercent);
      if (bucketIndex >= 0 && bucketIndex < 10) {
        askBuckets[bucketIndex].amount += ask.amount || ask.quantity || 0;
      }
    }
  }

  // Populate bids
  for (const bid of bids) {
    const diff = (currentPrice - bid.price) / currentPrice;
    if (diff >= 0) {
      const bucketIndex = Math.floor(diff / bucketSizePercent);
      if (bucketIndex >= 0 && bucketIndex < 10) {
        bidBuckets[bucketIndex].amount += bid.amount || bid.quantity || 0;
      }
    }
  }

  // Calculate cumulative totals for depth overlay visualization
  let askTotal = 0;
  const cleanAsks = askBuckets.map(b => {
    askTotal += b.amount;
    return { ...b, total: askTotal };
  });

  let bidTotal = 0;
  const cleanBids = bidBuckets.map(b => {
    bidTotal += b.amount;
    return { ...b, total: bidTotal };
  });

  return {
    asks: cleanAsks.reverse(), // reverse asks so highest price displays on top in UI
    bids: cleanBids
  };
}

export default function AlphaStream() {
  const lwc = useLightweightCharts();
  
  // Font Injection
  useEffect(() => {
    if (!document.getElementById("inter-font")) {
      const link = document.createElement('link');
      link.id = "inter-font";
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, []);

  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [isStale, setIsStale] = useState(false);
  const [metrics, setMetrics] = useState({ spread: 0, volatility: 0, ema15: null, ema50: null });
  const [showEMA, setShowEMA] = useState(false);
  
  const ema15SeriesRef = useRef(null);
  const ema50SeriesRef = useRef(null);
  const staleTimerRef = useRef(null);
  const socketRef = useRef(null);

  const [chartViewMode, setChartViewMode] = useState("LWC"); // "LWC" or "SVG"
  const [livePriceBuffer, setLivePriceBuffer] = useState([]);
  const [workerMetrics, setWorkerMetrics] = useState({ volatility: 0, ema10: null, emaArray: [] });

  const workerRef = useRef(null);
  const rawOrderBookRef = useRef({ bids: [], asks: [] });
  const orderBookPendingRef = useRef(false);

  const [theme, setTheme] = useState(() => localStorage.getItem('alphastream-theme') || 'dark');
  const [chartType, setChartType] = useState("Candles");
  const [showChartTypePicker, setShowChartTypePicker] = useState(false);

  const [pairsList, setPairsList] = useState(INITIAL_PAIRS);
  const [selectedPair, setSelectedPair] = useState(INITIAL_PAIRS[0]);
  const [pairSearch, setPairSearch] = useState("");
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[4]);

  const [price, setPrice] = useState(selectedPair.price);
  const [priceDir, setPriceDir] = useState(1);
  const [orderBook, setOrderBook] = useState(() => generateOrderBook(selectedPair.price));
  const [trades, setTrades] = useState(() => generateInitialTrades(selectedPair.price));
  
  const [wallet, setWallet] = useState(10000);
  const [btcBal, setBtcBal] = useState(0.0);
  const [buyPrice, setBuyPrice] = useState(selectedPair.price.toFixed(2));
  const [buyAmt, setBuyAmt] = useState("");
  const [buyError, setBuyError] = useState("");
  const [sellError, setSellError] = useState("");
  const [buyFlash, setBuyFlash] = useState("");
  const [sellFlash, setSellFlash] = useState("");

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const extraSeriesRefs = useRef([]);
  const volumeSeriesRef = useRef(null);
  const chartDataRef = useRef({ candles: [], volumes: [] });
  const typePickerRef = useRef(null);

  const selectedPairRef = useRef(selectedPair);
  const chartTypeRef = useRef(chartType);
  const showEMARef = useRef(showEMA);
  const timeframeRef = useRef(timeframe);

  useEffect(() => { selectedPairRef.current = selectedPair; }, [selectedPair]);
  useEffect(() => { chartTypeRef.current = chartType; }, [chartType]);
  useEffect(() => { showEMARef.current = showEMA; }, [showEMA]);
  useEffect(() => { timeframeRef.current = timeframe; }, [timeframe]);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('alphastream-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handler = (e) => {
      if (typePickerRef.current && !typePickerRef.current.contains(e.target)) {
        setShowChartTypePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Initialize Base Chart
  useEffect(() => {
    if (!lwc || !chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const bg = theme === 'light' ? '#ffffff' : '#0b0e11';
    const textColor = theme === 'light' ? '#707a8a' : '#848e9c';
    const gridColor = theme === 'light' ? '#f0f0f0' : '#1e2329';

    const w = chartContainerRef.current.offsetWidth;
    const h = chartContainerRef.current.offsetHeight;

    const chart = lwc.createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      width: w,
      height: h,
      crosshair: { mode: lwc.CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    const handleResize = (entries) => {
      if (chartContainerRef.current && chartRef.current && entries[0]) {
        const { width, height } = entries[0].contentRect;
        chartRef.current.applyOptions({ width, height });
      }
    };
    
    const observer = new ResizeObserver(handleResize);
    observer.observe(chartContainerRef.current);

    return () => {
      observer.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [lwc]);

  // Re-generate Data
  useEffect(() => {
    const { candles, volumes } = generateCandles(selectedPair.price, timeframe.ms);
    chartDataRef.current = { candles, volumes };
    setPrice(selectedPair.price);
    setBuyPrice(selectedPair.price.toFixed(2));
    setOrderBook(generateOrderBook(selectedPair.price));
    setTrades(generateInitialTrades(selectedPair.price));

    // Seed price buffer for WebWorker calculations
    const initialPrices = candles.map(c => c.close);
    setLivePriceBuffer(initialPrices);
    if (workerRef.current) {
        workerRef.current.postMessage({ prices: initialPrices });
    }
  }, [selectedPair.name, timeframe]);

  // Handle Chart Type & Apply Data
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartRef.current;

    const bg = theme === 'light' ? '#ffffff' : '#0b0e11';
    const textColor = theme === 'light' ? '#707a8a' : '#848e9c';
    const gridColor = theme === 'light' ? '#f0f0f0' : '#1e2329';
    chart.applyOptions({
      layout: { background: { type: 'solid', color: bg }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
    });

    if (mainSeriesRef.current) chart.removeSeries(mainSeriesRef.current);
    extraSeriesRefs.current.forEach(s => chart.removeSeries(s));
    extraSeriesRefs.current = [];

    const { candles, volumes } = chartDataRef.current;
    if (!candles.length) return;

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(volumes);
    }

    if (showEMA) {
        ema15SeriesRef.current = chart.addLineSeries({ color: '#c2a1ff', lineWidth: 1.5 });
        ema50SeriesRef.current = chart.addLineSeries({ color: '#ff6838', lineWidth: 1.5 });
        const ema15Data = calculateHistoricalEMA(candles, 15);
        const ema50Data = calculateHistoricalEMA(candles, 50);
        ema15SeriesRef.current.setData(ema15Data);
        ema50SeriesRef.current.setData(ema50Data);
        extraSeriesRefs.current.push(ema15SeriesRef.current, ema50SeriesRef.current);
    }

    const up = '#0ecb81';
    const down = '#f6465d';
    const lineColor = theme === 'light' ? '#1e2329' : '#eaecef';
    const faintColor = theme === 'light' ? 'rgba(112,122,138,0.5)' : 'rgba(132,142,156,0.5)';

    let mainSeries;
    
    switch (chartType) {
      case "Bars":
        mainSeries = chart.addBarSeries({ upColor: up, downColor: down });
        mainSeries.setData(candles);
        break;
      case "Candles":
      case "Volume candles":
        mainSeries = chart.addCandlestickSeries({ upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down });
        mainSeries.setData(candles);
        break;
      case "Hollow candles":
        mainSeries = chart.addCandlestickSeries({ upColor: 'transparent', borderUpColor: up, wickUpColor: up, downColor: down, borderDownColor: down, wickDownColor: down });
        mainSeries.setData(candles);
        break;
      case "Line":
        mainSeries = chart.addLineSeries({ color: lineColor, lineWidth: 2 });
        mainSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
        break;
      case "Line with markers":
        mainSeries = chart.addLineSeries({ color: lineColor, lineWidth: 2 });
        mainSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
        mainSeries.setMarkers(candles.map(c => ({
          time: c.time, position: c.close >= c.open ? 'belowBar' : 'aboveBar', color: c.close >= c.open ? up : down, shape: c.close >= c.open ? 'arrowUp' : 'arrowDown',
        })));
        break;
      case "Step line":
        mainSeries = chart.addLineSeries({ color: lineColor, lineWidth: 2, lineType: 2 });
        mainSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
        break;
      case "Area":
        mainSeries = chart.addAreaSeries({ lineColor: '#f0b90b', topColor: 'rgba(240, 185, 11, 0.4)', bottomColor: 'rgba(240, 185, 11, 0.0)' });
        mainSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
        break;
      case "HLC area":
        const hSeries = chart.addLineSeries({ color: faintColor, lineWidth: 1 });
        const lSeries = chart.addLineSeries({ color: faintColor, lineWidth: 1 });
        mainSeries = chart.addLineSeries({ color: lineColor, lineWidth: 2 });
        hSeries.setData(candles.map(c => ({ time: c.time, value: c.high })));
        lSeries.setData(candles.map(c => ({ time: c.time, value: c.low })));
        mainSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
        extraSeriesRefs.current = [hSeries, lSeries];
        break;
      case "Baseline":
        const sum = candles.slice(-7).reduce((acc, c) => acc + c.close, 0);
        const avg = sum / Math.min(candles.length, 7);
        mainSeries = chart.addBaselineSeries({ baseValue: { type: 'price', price: avg }, topLineColor: up, topFillColor1: 'rgba(14,203,129,0.3)', topFillColor2: 'rgba(14,203,129,0)', bottomLineColor: down, bottomFillColor1: 'rgba(246,70,93,0)', bottomFillColor2: 'rgba(246,70,93,0.3)' });
        mainSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
        break;
      default:
        break;
    }

    mainSeriesRef.current = mainSeries;
    chart.timeScale().fitContent();
  }, [chartType, theme, selectedPair.name, timeframe, lwc]);

  // Backend Integration & WebSockets
  useEffect(() => {
    // 1. Initialize WebWorker
    workerRef.current = new MathWorker();
    workerRef.current.onmessage = (e) => {
        const { ema, volatility } = e.data;
        const latestEMA = ema && ema.length > 0 ? ema[ema.length - 1] : null;
        setWorkerMetrics({
            volatility: volatility || 0,
            ema10: latestEMA,
            emaArray: ema || []
        });
    };

    // 2. Order book update interval (2 times per second)
    const orderBookInterval = setInterval(() => {
        if (orderBookPendingRef.current) {
            orderBookPendingRef.current = false;
            const currentP = selectedPairRef.current.price;
            const aggregated = aggregateOrderBook(
                rawOrderBookRef.current.bids,
                rawOrderBookRef.current.asks,
                currentP
            );
            setOrderBook(aggregated);
        }
    }, 500);

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

    socket.on("system_status", (payload) => {
      if (payload.status === "OUTAGE") {
        setSocketStatus("outage");
      } else {
        setSocketStatus("connected");
      }
    });

    socket.on("live_price_update", (payload) => {
      clearTimeout(staleTimerRef.current);
      setIsStale(false);
      staleTimerRef.current = setTimeout(() => setIsStale(true), 5000);

      const activePair = selectedPairRef.current;
      const isCurrentPair = payload.symbol.toLowerCase() === activePair.name.replace("/", "").toLowerCase();

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
        
        // Push price to local buffer for WebWorker offloading
        setLivePriceBuffer(prev => {
          const updated = [...prev, newPrice];
          if (updated.length > 100) updated.shift();
          if (workerRef.current) {
            workerRef.current.postMessage({ prices: updated });
          }
          return updated;
        });

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
          let lastCandle = candles[candles.length - 1];
          let lastVol = volumes[volumes.length - 1];
          
          const currentTf = timeframeRef.current;
          const tfSec = Math.floor(currentTf.ms / 1000);
          const currentBarTime = Math.floor(Date.now() / 1000 / tfSec) * tfSec;

          if (currentBarTime > lastCandle.time) {
            const newCandle = {
              time: currentBarTime,
              open: lastCandle.close,
              high: newPrice,
              low: newPrice,
              close: newPrice
            };
            const newVol = {
              time: currentBarTime,
              value: +(Math.random() * 2).toFixed(2),
              color: newCandle.close >= newCandle.open ? "rgba(14,203,129,0.5)" : "rgba(246,70,93,0.5)"
            };
            candles.push(newCandle);
            volumes.push(newVol);
            lastCandle = newCandle;
            lastVol = newVol;
          } else {
            lastCandle.close = newPrice;
            if (newPrice > lastCandle.high) lastCandle.high = newPrice;
            if (newPrice < lastCandle.low) lastCandle.low = newPrice;
            
            lastVol.color = lastCandle.close >= lastCandle.open ? "rgba(14,203,129,0.5)" : "rgba(246,70,93,0.5)";
            lastVol.value += +(Math.random() * 2).toFixed(2);
          }

          const updateObj = { time: lastCandle.time, open: lastCandle.open, high: lastCandle.high, low: lastCandle.low, close: lastCandle.close };
          const lineObj = { time: lastCandle.time, value: lastCandle.close };
          
          const currentChartType = chartTypeRef.current;
          if (currentChartType === "Bars" || currentChartType.toLowerCase().includes("candles")) {
            mainSeriesRef.current.update(updateObj);
          } else if (currentChartType === "HLC area") {
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
      const activePair = selectedPairRef.current;
      if (payload.symbol.toLowerCase() === activePair.name.replace("/", "").toLowerCase()) {
        rawOrderBookRef.current = {
          bids: payload.bids,
          asks: payload.asks
        };
        orderBookPendingRef.current = true;
      }
    });

    socket.on("live_metrics_update", (payload) => {
      const activePair = selectedPairRef.current;
      if (payload.symbol.toLowerCase() === activePair.name.replace("/", "").toLowerCase()) {
        setMetrics(payload);
        
        const currentTf = timeframeRef.current;
        const tfSec = Math.floor(currentTf.ms / 1000);
        const currentBarTime = Math.floor(Date.now() / 1000 / tfSec) * tfSec;
        
        if (showEMARef.current) {
            if (ema15SeriesRef.current && payload.ema15) ema15SeriesRef.current.update({ time: currentBarTime, value: payload.ema15 });
            if (ema50SeriesRef.current && payload.ema50) ema50SeriesRef.current.update({ time: currentBarTime, value: payload.ema50 });
        }
      }
    });

    return () => {
      socket.disconnect();
      clearTimeout(staleTimerRef.current);
      clearInterval(orderBookInterval);
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const filteredPairs = useMemo(() => 
    pairsList.filter((p) => p.name.toLowerCase().includes(pairSearch.toLowerCase())),
  [pairsList, pairSearch]);

  const handleBuy = useCallback(async () => {
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
        setBuyFlash(`✓ Filled at ${p}`);
        setTimeout(() => setBuyFlash(""), 2000);
    } catch (err) {
        setBuyError(err.response?.data?.error || "Trade failed");
    }
  }, [buyAmt, buyPrice, wallet, selectedPair.name]);

  const handleSell = useCallback(async () => {
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
        setSellFlash(`✓ Sold at ${p}`);
        setTimeout(() => setSellFlash(""), 2000);
    } catch (err) {
        setSellError(err.response?.data?.error || "Trade failed");
    }
  }, [buyAmt, buyPrice, btcBal, selectedPair.name]);

  const applyPercent = useCallback((pct, type) => {
    const p = parseFloat(buyPrice) || price;
    if (type === "buy") {
      const maxAmt = wallet / p;
      setBuyAmt((maxAmt * pct).toFixed(5));
      setBuyError("");
    } else {
      setBuyAmt((btcBal * pct).toFixed(5));
      setSellError("");
    }
  }, [wallet, btcBal, buyPrice, price]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const maxAskTotal = orderBook.asks.length ? Math.max(...orderBook.asks.map((r) => r.total)) : 1;
  const maxBidTotal = orderBook.bids.length ? Math.max(...orderBook.bids.map((r) => r.total)) : 1;
  const askOpacity = theme === 'light' ? '0.08' : '0.12';
  const bidOpacity = theme === 'light' ? '0.08' : '0.12';

  const sunIcon = <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2m8-10h-2M4 12H2m15.536-7.536l-1.414 1.414M6.879 17.121l-1.414 1.414m12.071 0l-1.414-1.414M6.879 6.879L5.465 5.465"/></svg>;
  const moonIcon = <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;

  return (
    <>
      <style>{`
        html, body, #root {
          margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;
        }
        :root {
          --bg-primary: #0b0e11; --bg-secondary: #1e2329; --bg-tertiary: #2b3139;
          --text-primary: #eaecef; --text-secondary: #848e9c;
          --border: #2b3139; --accent: #f0b90b;
          font-family: 'Inter', 'SF Pro Text', -apple-system, sans-serif;
        }
        body[data-theme="light"] {
          --bg-primary: #ffffff; --bg-secondary: #f5f5f5; --bg-tertiary: #e8e8e8;
          --text-primary: #1e2329; --text-secondary: #707a8a;
          --border: #e0e0e0; --accent: #f0b90b;
        }
        .mono {
          font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--bg-tertiary); border-radius: 2px; }
        input[type="number"]::-webkit-inner-spin-button, 
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .hover-btn:hover { background: var(--bg-secondary); }
        .buy-btn:hover { background: #00b574; transform: scale(1.01); }
        .buy-btn:active { transform: scale(0.99); }
        .sell-btn:hover { background: #d63651; transform: scale(1.01); }
        .sell-btn:active { transform: scale(0.99); }
        .pct-btn:hover { border-color: var(--accent) !important; color: var(--accent) !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", overflow: "hidden", background: "var(--bg-primary)", color: "var(--text-primary)", boxSizing: "border-box" }}>
        
        {isStale && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(246,70,93,0.9)", color: "#fff", padding: "16px 24px", borderRadius: "8px", zIndex: 1000, fontWeight: 700, fontSize: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", gap: "10px" }}>
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>
            STALE DATA WARNING
          </div>
        )}

        {socketStatus === "outage" && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(239,68,68,0.95)", color: "#fff", padding: "24px 32px", borderRadius: "12px", zIndex: 1001, fontWeight: 700, fontSize: "18px", boxShadow: "0 8px 24px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", border: "2px solid #ef4444" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2.5" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>
              <span>CRITICAL SYSTEM OUTAGE</span>
            </div>
            <span style={{ fontSize: "14px", fontWeight: 500, opacity: 0.9 }}>Binance exchange streams are currently offline. Circuit breaker activated.</span>
          </div>
        )}
        
        {/* ROW 1: Ticker Bar */}
        <div style={{ height: "48px", flexShrink: 0, display: "flex", alignItems: "center", gap: 0, borderBottom: "1px solid var(--border)", background: "var(--bg-primary)", overflowX: "auto", overflowY: "hidden" }}>
          {pairsList.map((p) => (
            <div className="hover-btn" key={p.name} onClick={() => setSelectedPair(p)} style={{ minWidth: "120px", padding: "0 16px", display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer", borderRight: "1px solid var(--border)", height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-secondary)" }}>{p.name}</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: p.change >= 0 ? "#0ecb81" : "#f6465d" }}>{p.change >= 0 ? "+" : ""}{p.change.toFixed(2)}%</span>
              </div>
              <span className="mono" style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>{p.price.toFixed(p.price > 100 ? 2 : 5)}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", padding: "0 16px", display: "flex", alignItems: "center", cursor: "pointer" }} onClick={toggleTheme}>
            {theme === 'light' ? moonIcon : sunIcon}
          </div>
        </div>

        {/* ROW 2: Main Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          
          {/* COL A: Order Book */}
          <div style={{ width: "220px", flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)" }}>
            <div style={{ padding: "8px 10px", fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Order Book</div>
            <div style={{ display: "flex", padding: "4px 10px", fontSize: "11px", fontWeight: 500, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
              <span style={{ width: "90px", textAlign: "left" }}>Price</span>
              <span style={{ width: "70px", textAlign: "right" }}>Amount</span>
              <span style={{ flex: 1, textAlign: "right" }}>Total</span>
            </div>
            
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column-reverse" }}>
              {orderBook.asks.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", height: "22px", padding: "0 10px", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, zIndex: 0, background: `rgba(246,70,93,${askOpacity})`, width: `${(r.total / maxAskTotal) * 100}%` }} />
                  <span className="mono" style={{ width: "90px", textAlign: "left", color: "#f6465d", fontSize: "13px", zIndex: 1 }}>{r.price.toFixed(2)}</span>
                  <span className="mono" style={{ width: "70px", textAlign: "right", color: "var(--text-primary)", fontSize: "13px", zIndex: 1 }}>{r.amount.toFixed(4)}</span>
                  <span className="mono" style={{ flex: 1, textAlign: "right", color: "var(--text-secondary)", fontSize: "13px", zIndex: 1 }}>{r.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ height: "32px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
              <span className="mono" style={{ fontSize: "18px", fontWeight: 700, color: priceDir >= 0 ? "#0ecb81" : "#f6465d" }}>
                {price.toFixed(2)} {priceDir >= 0 ? "↑" : "↓"}
              </span>
            </div>

            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {orderBook.bids.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", height: "22px", padding: "0 10px", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, zIndex: 0, background: `rgba(14,203,129,${bidOpacity})`, width: `${(r.total / maxBidTotal) * 100}%` }} />
                  <span className="mono" style={{ width: "90px", textAlign: "left", color: "#0ecb81", fontSize: "13px", zIndex: 1 }}>{r.price.toFixed(2)}</span>
                  <span className="mono" style={{ width: "70px", textAlign: "right", color: "var(--text-primary)", fontSize: "13px", zIndex: 1 }}>{r.amount.toFixed(4)}</span>
                  <span className="mono" style={{ flex: 1, textAlign: "right", color: "var(--text-secondary)", fontSize: "13px", zIndex: 1 }}>{r.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COL B: Center */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
            
            {/* ROW B1: Pair header */}
            <div style={{ height: "48px", flexShrink: 0, padding: "0 16px", display: "flex", alignItems: "center", gap: "24px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "18px", fontWeight: 700 }}>{selectedPair.name}</span>
                <span className="mono" style={{ fontSize: "22px", fontWeight: 700, color: selectedPair.change >= 0 ? "#0ecb81" : "#f6465d" }}>{price.toFixed(price > 100 ? 2 : 5)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>24h Change</span>
                <span style={{ fontSize: "13px", fontWeight: 400, color: selectedPair.change >= 0 ? "#0ecb81" : "#f6465d" }}>{selectedPair.change >= 0 ? "+" : ""}{selectedPair.change.toFixed(2)}%</span>
              </div>
            </div>

            {/* ROW B2: Chart Toolbar */}
            <div style={{ height: "36px", flexShrink: 0, display: "flex", alignItems: "center", padding: "0 12px", gap: "8px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                {TIMEFRAMES.map(tf => {
                  const active = timeframe.label === tf.label;
                  return (
                    <div key={tf.label} onClick={() => setTimeframe(tf)} style={{ height: "26px", padding: "0 10px", display: "flex", alignItems: "center", fontSize: "13px", fontWeight: 500, borderRadius: "4px", cursor: "pointer", background: active ? "var(--bg-secondary)" : "transparent", color: active ? "var(--accent)" : "var(--text-secondary)", border: active ? "1px solid var(--border)" : "1px solid transparent" }}>
                      {tf.label}
                    </div>
                  )
                })}
              </div>
              
              <div style={{ width: "1px", height: "16px", background: "var(--border)", margin: "0 8px" }} />

              <div ref={typePickerRef} style={{ position: "relative" }}>
                <div onClick={() => setShowChartTypePicker(!showChartTypePicker)} style={{ height: "26px", padding: "0 10px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", borderRadius: "4px", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "13px", fontWeight: 500 }}>
                  {ICONS[chartType]}
                  <span>{chartType}</span>
                </div>
                {showChartTypePicker && (
                  <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", background: "#1a1d23", border: "1px solid #2b3139", borderRadius: "8px", minWidth: "220px", zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                    {CHART_GROUPS.map((group, gIdx) => (
                      <div key={group.label}>
                        {gIdx > 0 && <div style={{ height: "1px", background: "#2b3139" }} />}
                        <div style={{ padding: "8px 12px", fontSize: "11px", textTransform: "uppercase", color: "#848e9c" }}>{group.label}</div>
                        {group.items.map(item => {
                          const isSel = chartType === item;
                          return (
                            <div key={item} onClick={() => { setChartType(item); setShowChartTypePicker(false); }}
                              style={{ display: "flex", alignItems: "center", gap: "10px", height: "32px", padding: "0 12px", cursor: "pointer", background: isSel ? "#1e2329" : "transparent", borderLeft: isSel ? "2px solid #f0b90b" : "2px solid transparent", color: isSel ? "#f0b90b" : "#eaecef" }}
                              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "#2b3139"; }} onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                              {ICONS[item]}
                              <span style={{ fontSize: "13px" }}>{item}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ROW B3: MA Indicators */}
            <div style={{ height: "26px", flexShrink: 0, display: "flex", alignItems: "center", gap: "16px", padding: "0 16px" }}>
              <div onClick={() => setShowEMA(!showEMA)} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", background: showEMA ? "var(--bg-secondary)" : "transparent", padding: "2px 8px", borderRadius: "4px", border: showEMA ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
                <span className="mono" style={{ fontSize: "12px", fontWeight: 600, color: showEMA ? "var(--accent)" : "var(--text-secondary)" }}>EMA 15/50</span>
              </div>
              <div onClick={() => setChartViewMode(prev => prev === "LWC" ? "SVG" : "LWC")} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", background: chartViewMode === "SVG" ? "var(--bg-secondary)" : "transparent", padding: "2px 8px", borderRadius: "4px", border: chartViewMode === "SVG" ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
                <span className="mono" style={{ fontSize: "12px", fontWeight: 600, color: chartViewMode === "SVG" ? "var(--accent)" : "var(--text-secondary)" }}>Custom SVG Path Chart</span>
              </div>
              <div style={{ display: "flex", gap: "16px", marginLeft: "auto" }}>
                <span className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Spread: <span style={{ color: "var(--text-primary)" }}>{metrics.spread ? metrics.spread.toFixed(2) : '-'}</span></span>
                <span className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Vol (Server): <span style={{ color: "var(--text-primary)" }}>{metrics.volatility ? metrics.volatility.toFixed(4) : '-'}</span></span>
                <span className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Vol (Worker): <span style={{ color: "var(--text-primary)" }}>{workerMetrics.volatility ? workerMetrics.volatility.toFixed(4) : '-'}</span></span>
                <span className="mono" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>EMA10 (Worker): <span style={{ color: "var(--text-primary)" }}>{workerMetrics.ema10 ? workerMetrics.ema10.toFixed(2) : '-'}</span></span>
              </div>
            </div>

            {/* ROW B4: Chart Container */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
              <div ref={chartContainerRef} style={{ display: chartViewMode === "LWC" ? "block" : "none", width: "100%", height: "100%" }} />
              {chartViewMode === "SVG" && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "var(--bg-primary)", overflow: "hidden" }}>
                  <SvgChart data={livePriceBuffer.map(p => ({ price: p }))} emaData={workerMetrics.emaArray} />
                </div>
              )}
            </div>

            {/* ROW B5: Trade Form */}
            <div style={{ height: "280px", flexShrink: 0, borderTop: "2px solid var(--border)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px", background: "var(--bg-primary)" }}>
              {/* Form Tabs */}
              <div style={{ display: "flex", gap: "8px" }}>
                {["Spot", "Cross", "Isolated"].map((t, i) => (
                  <div key={t} style={{ fontSize: "13px", fontWeight: 500, padding: "4px 12px", borderRadius: "12px", background: i === 0 ? "var(--bg-secondary)" : "transparent", color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)", cursor: "pointer" }}>{t}</div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
                {["Limit", "Market", "Stop Limit"].map((t, i) => (
                  <div key={t} style={{ fontSize: "13px", fontWeight: 500, color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)", borderBottom: i === 0 ? "2px solid var(--accent)" : "2px solid transparent", cursor: "pointer", paddingBottom: "4px", marginBottom: "-5px" }}>{t}</div>
                ))}
              </div>

              {/* Form Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1, paddingTop: "8px" }}>
                
                {/* Buy Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Avail: {wallet.toFixed(2)} USDT</div>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 12px", height: "40px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", width: "40px" }}>Price</span>
                    <input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} className="mono" style={{ flex: 1, fontSize: "14px", textAlign: "right", border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", minWidth: 0 }} />
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "8px" }}>USDT</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 12px", height: "40px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", width: "48px" }}>Amount</span>
                    <input type="number" value={buyAmt} onChange={(e) => setBuyAmt(e.target.value)} className="mono" placeholder="0.0000" style={{ flex: 1, fontSize: "14px", textAlign: "right", border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", minWidth: 0 }} />
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "8px" }}>{selectedPair.name.split("/")[0]}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
                    {[0.25, 0.5, 0.75, 1].map(pct => (
                      <button key={pct} className="pct-btn" onClick={() => applyPercent(pct, "buy")} style={{ height: "28px", fontSize: "12px", fontWeight: 600, background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-secondary)", cursor: "pointer" }}>{pct * 100}%</button>
                    ))}
                  </div>
                  <div style={{ position: "relative" }}>
                    <button className="buy-btn" onClick={handleBuy} style={{ height: "44px", background: "#0ecb81", color: "#000", fontSize: "16px", fontWeight: 700, borderRadius: "6px", border: "none", cursor: "pointer", width: "100%", letterSpacing: "0.05em", transition: "transform 0.05s" }}>BUY {selectedPair.name.split("/")[0]}</button>
                    {buyError && <div style={{ color: "#f6465d", fontSize: "11px", position: "absolute", top: "100%", left: 0, marginTop: "2px" }}>{buyError}</div>}
                    {buyFlash && <div style={{ background: "#0ecb81", color: "#000", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", position: "absolute", top: "-10px", right: 0 }}>{buyFlash}</div>}
                  </div>
                </div>

                {/* Sell Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Avail: {btcBal.toFixed(5)} {selectedPair.name.split("/")[0]}</div>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 12px", height: "40px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", width: "40px" }}>Price</span>
                    <input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} className="mono" style={{ flex: 1, fontSize: "14px", textAlign: "right", border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", minWidth: 0 }} />
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "8px" }}>USDT</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0 12px", height: "40px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", width: "48px" }}>Amount</span>
                    <input type="number" value={buyAmt} onChange={(e) => setBuyAmt(e.target.value)} className="mono" placeholder="0.0000" style={{ flex: 1, fontSize: "14px", textAlign: "right", border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", minWidth: 0 }} />
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "8px" }}>{selectedPair.name.split("/")[0]}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
                    {[0.25, 0.5, 0.75, 1].map(pct => (
                      <button key={pct} className="pct-btn" onClick={() => applyPercent(pct, "sell")} style={{ height: "28px", fontSize: "12px", fontWeight: 600, background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-secondary)", cursor: "pointer" }}>{pct * 100}%</button>
                    ))}
                  </div>
                  <div style={{ position: "relative" }}>
                    <button className="sell-btn" onClick={handleSell} style={{ height: "44px", background: "#f6465d", color: "#fff", fontSize: "16px", fontWeight: 700, borderRadius: "6px", border: "none", cursor: "pointer", width: "100%", letterSpacing: "0.05em", transition: "transform 0.05s" }}>SELL {selectedPair.name.split("/")[0]}</button>
                    {sellError && <div style={{ color: "#f6465d", fontSize: "11px", position: "absolute", top: "100%", left: 0, marginTop: "2px" }}>{sellError}</div>}
                    {sellFlash && <div style={{ background: "#f6465d", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px", position: "absolute", top: "-10px", right: 0 }}>{sellFlash}</div>}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* COL C: Right Panel */}
          <div style={{ width: "280px", flexShrink: 0, overflow: "hidden", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
            
            {/* Markets */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>Markets</div>
              <input placeholder="Search" value={pairSearch} onChange={(e) => setPairSearch(e.target.value)} style={{ margin: "8px 12px", height: "32px", width: "calc(100% - 24px)", boxSizing: "border-box", fontSize: "13px", padding: "0 10px", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-primary)", outline: "none" }} />
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 70px", padding: "4px 12px", fontSize: "11px", color: "var(--text-secondary)" }}>
                <span>Pair</span>
                <span style={{ textAlign: "right" }}>Last Price</span>
                <span style={{ textAlign: "right" }}>24h Chg</span>
              </div>
              <div style={{ maxHeight: `${8 * 32}px`, overflowY: "auto" }}>
                {filteredPairs.map((p) => {
                  const isSel = selectedPair.name === p.name;
                  return (
                    <div key={p.name} onClick={() => setSelectedPair(p)} style={{ height: "32px", padding: "0 12px", display: "grid", gridTemplateColumns: "80px 1fr 70px", alignItems: "center", cursor: "pointer", background: isSel ? "var(--bg-secondary)" : "transparent", borderLeft: isSel ? "2px solid var(--accent)" : "2px solid transparent" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginLeft: isSel ? "-2px" : "0" }}>{p.name.split("/")[0]}</span>
                      <span className="mono" style={{ fontSize: "13px", textAlign: "right" }}>{p.price > 100 ? p.price.toFixed(2) : p.price.toFixed(5)}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, textAlign: "right", color: p.change >= 0 ? "#0ecb81" : "#f6465d" }}>{p.change >= 0 ? "+" : ""}{p.change.toFixed(2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Market Trades */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "14px", fontWeight: 600, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>Market Trades</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "4px 12px", fontSize: "11px", color: "var(--text-secondary)" }}>
                <span>Price (USDT)</span>
                <span style={{ textAlign: "right" }}>Amount</span>
                <span style={{ textAlign: "right" }}>Time</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {trades.map((t) => (
                  <div key={t.id} style={{ height: "26px", padding: "0 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: "13px", color: t.side === "buy" ? "#0ecb81" : "#f6465d" }}>{t.price.toFixed(2)}</span>
                    <span className="mono" style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", textAlign: "right" }}>{t.amount.toFixed(5)}</span>
                    <span className="mono" style={{ fontSize: "13px", color: "var(--text-secondary)", textAlign: "right" }}>{t.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ROW 3: Status Bar */}
        <div style={{ height: "28px", flexShrink: 0, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 12px", gap: "24px", background: "var(--bg-secondary)", fontSize: "12px", fontWeight: 500, overflow: "hidden" }}>
          <span style={{ color: socketStatus === 'connected' ? "#0ecb81" : "#f6465d", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: socketStatus === 'connected' ? "#0ecb81" : "#f6465d" }}></span>
            {socketStatus === 'connected' ? "LIVE WEBSOCKET CONNECTED" : "WEBSOCKET DISCONNECTED"}
          </span>
          {pairsList.slice(0, 10).map((p) => (
            <div key={p.name} style={{ display: "flex", gap: "6px", flexShrink: 0, color: "var(--text-secondary)" }}>
              <span>{p.name}</span>
              <span style={{ color: p.change >= 0 ? "#0ecb81" : "#f6465d" }}>{p.change >= 0 ? "+" : ""}{p.change.toFixed(2)}%</span>
              <span className="mono">{p.price > 100 ? p.price.toFixed(2) : p.price.toFixed(5)}</span>
            </div>
          ))}
        </div>

      </div>
    </>
  );
}