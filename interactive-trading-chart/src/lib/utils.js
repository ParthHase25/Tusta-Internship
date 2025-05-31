// Binance API configuration
const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';

// Default settings
export const DEFAULT_SYMBOL = 'BTCUSDT';
export const DEFAULT_INTERVAL = '1h';

// Available intervals
export const INTERVALS = {
  '1m': '1 Minute',
  '3m': '3 Minutes', 
  '5m': '5 Minutes',
  '15m': '15 Minutes',
  '30m': '30 Minutes',
  '1h': '1 Hour',
  '2h': '2 Hours',
  '4h': '4 Hours',
  '6h': '6 Hours',
  '8h': '8 Hours',
  '12h': '12 Hours',
  '1d': '1 Day',
  '3d': '3 Days',
  '1w': '1 Week',
  '1M': '1 Month'
};

// Popular trading pairs
export const TRADING_PAIRS = [
  'BTCUSDT',
  'ETHUSDT', 
  'BNBUSDT',
  'ADAUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOTUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
  'MATICUSDT',
  'LINKUSDT',
  'UNIUSDT',
  'LTCUSDT',
  'BCHUSDT',
  'FILUSDT'
];

/**
 * Fetch real candlestick data from Binance API
 */
export async function fetchBinanceData(symbol = DEFAULT_SYMBOL, interval = DEFAULT_INTERVAL, limit = 200) {
  try {
    const url = `${BINANCE_BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    console.log(`🔄 Fetching Binance data: ${symbol} ${interval} (${limit} candles)`);
    console.log(`📡 API URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
    }
    
    const rawData = await response.json();
    
    if (!Array.isArray(rawData) || rawData.length === 0) {
      throw new Error('Invalid or empty response from Binance API');
    }
    
    console.log(`📊 Received ${rawData.length} raw candles from Binance`);
    
    // Transform Binance data format to our chart format
    const transformedData = rawData.map((kline, index) => {
      const candle = {
        time: Math.floor(kline[0] / 1000), // Convert milliseconds to seconds
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]), 
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5])
      };
      
      // Validate each candle
      if (isNaN(candle.time) || isNaN(candle.open) || isNaN(candle.high) || 
          isNaN(candle.low) || isNaN(candle.close) || isNaN(candle.volume)) {
        console.warn(`⚠️ Invalid candle at index ${index}:`, candle);
        return null;
      }
      
      // Validate OHLC relationships
      if (candle.high < candle.low || 
          candle.high < Math.max(candle.open, candle.close) ||
          candle.low > Math.min(candle.open, candle.close)) {
        console.warn(`⚠️ Invalid OHLC relationships at index ${index}:`, candle);
        return null;
      }
      
      return candle;
    }).filter(Boolean); // Remove null entries
    
    console.log(`✅ Successfully processed ${transformedData.length} valid candles`);
    console.log(`📈 Price range: $${Math.min(...transformedData.map(c => c.low)).toFixed(2)} - $${Math.max(...transformedData.map(c => c.high)).toFixed(2)}`);
    
    return transformedData;
    
  } catch (error) {
    console.error('❌ Binance API fetch error:', error);
    
    // Return mock data as fallback
    console.log('🔄 Falling back to mock data...');
    return generateMockData(symbol, limit);
  }
}

/**
 * Get current price for a symbol
 */
export async function getCurrentPrice(symbol = DEFAULT_SYMBOL) {
  try {
    const url = `${BINANCE_BASE_URL}/ticker/price?symbol=${symbol}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch current price: ${response.statusText}`);
    }
    
    const data = await response.json();
    return parseFloat(data.price);
    
  } catch (error) {
    console.error('Error fetching current price:', error);
    return null;
  }
}

/**
 * Get 24hr ticker statistics
 */
export async function get24hrStats(symbol = DEFAULT_SYMBOL) {
  try {
    const url = `${BINANCE_BASE_URL}/ticker/24hr?symbol=${symbol}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch 24hr stats: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      symbol: data.symbol,
      priceChange: parseFloat(data.priceChange),
      priceChangePercent: parseFloat(data.priceChangePercent),
      weightedAvgPrice: parseFloat(data.weightedAvgPrice),
      prevClosePrice: parseFloat(data.prevClosePrice),
      lastPrice: parseFloat(data.lastPrice),
      bidPrice: parseFloat(data.bidPrice),
      askPrice: parseFloat(data.askPrice),
      openPrice: parseFloat(data.openPrice),
      highPrice: parseFloat(data.highPrice),
      lowPrice: parseFloat(data.lowPrice),
      volume: parseFloat(data.volume),
      quoteVolume: parseFloat(data.quoteVolume),
      openTime: data.openTime,
      closeTime: data.closeTime,
      count: data.count
    };
    
  } catch (error) {
    console.error('Error fetching 24hr stats:', error);
    return null;
  }
}

/**
 * Generate mock data as fallback
 */
export function generateMockData(symbol = DEFAULT_SYMBOL, limit = 200) {
  console.log(`🎭 Generating mock data for ${symbol} (${limit} candles)`);
  
  const data = [];
  
  // Set realistic base price based on symbol
  let basePrice;
  switch (symbol) {
    case 'BTCUSDT': basePrice = 43000; break;
    case 'ETHUSDT': basePrice = 2300; break;
    case 'BNBUSDT': basePrice = 310; break;
    case 'ADAUSDT': basePrice = 0.38; break;
    case 'SOLUSDT': basePrice = 98; break;
    case 'XRPUSDT': basePrice = 0.52; break;
    case 'DOTUSDT': basePrice = 5.8; break;
    case 'DOGEUSDT': basePrice = 0.08; break;
    case 'AVAXUSDT': basePrice = 24; break;
    case 'MATICUSDT': basePrice = 0.73; break;
    default: basePrice = 100;
  }
  
  let currentPrice = basePrice;
  const now = Math.floor(Date.now() / 1000);
  const intervalSeconds = getIntervalSeconds(DEFAULT_INTERVAL);
  
  for (let i = limit - 1; i >= 0; i--) {
    const time = now - (i * intervalSeconds);
    const open = currentPrice;
    
    // More realistic price movements
    const volatility = getVolatilityForSymbol(symbol);
    const change = (Math.random() - 0.5) * volatility * currentPrice;
    const close = Math.max(open + change, currentPrice * 0.01); // Prevent negative prices
    
    const high = Math.max(open, close) + Math.random() * volatility * currentPrice * 0.5;
    const low = Math.max(Math.min(open, close) - Math.random() * volatility * currentPrice * 0.5, currentPrice * 0.01);
    
    // Realistic volume based on symbol
    const baseVolume = getBaseVolumeForSymbol(symbol);
    const volume = baseVolume * (0.5 + Math.random());
    
    data.push({
      time: time,
      open: Number(open.toFixed(getPrecisionForSymbol(symbol))),
      high: Number(high.toFixed(getPrecisionForSymbol(symbol))),
      low: Number(low.toFixed(getPrecisionForSymbol(symbol))),
      close: Number(close.toFixed(getPrecisionForSymbol(symbol))),
      volume: Number(volume.toFixed(2))
    });
    
    currentPrice = close;
  }
  
  console.log(`✅ Generated ${data.length} mock candles for ${symbol}`);
  return data;
}

// Helper functions
function getIntervalSeconds(interval) {
  const intervals = {
    '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
    '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800, '12h': 43200,
    '1d': 86400, '3d': 259200, '1w': 604800, '1M': 2592000
  };
  return intervals[interval] || 3600;
}

function getVolatilityForSymbol(symbol) {
  const volatilities = {
    'BTCUSDT': 0.03, 'ETHUSDT': 0.04, 'BNBUSDT': 0.05,
    'ADAUSDT': 0.06, 'SOLUSDT': 0.07, 'XRPUSDT': 0.05,
    'DOTUSDT': 0.06, 'DOGEUSDT': 0.08, 'AVAXUSDT': 0.07,
    'MATICUSDT': 0.06
  };
  return volatilities[symbol] || 0.05;
}

function getBaseVolumeForSymbol(symbol) {
  const volumes = {
    'BTCUSDT': 1000000, 'ETHUSDT': 500000, 'BNBUSDT': 200000,
    'ADAUSDT': 10000000, 'SOLUSDT': 300000, 'XRPUSDT': 50000000,
    'DOTUSDT': 1000000, 'DOGEUSDT': 100000000, 'AVAXUSDT': 500000,
    'MATICUSDT': 5000000
  };
  return volumes[symbol] || 1000000;
}

function getPrecisionForSymbol(symbol) {
  if (symbol.includes('USDT')) {
    if (['DOGEUSDT', 'ADAUSDT', 'XRPUSDT', 'MATICUSDT'].includes(symbol)) {
      return 6; // Lower price coins need more decimals
    }
    return 2; // Most USDT pairs use 2 decimals
  }
  return 8; // BTC pairs typically use 8 decimals
}

// Utility functions for price formatting
export function formatPrice(price, symbol = DEFAULT_SYMBOL) {
  const precision = getPrecisionForSymbol(symbol);
  return Number(price).toFixed(precision);
}

export function formatVolume(volume) {
  if (volume >= 1000000000) {
    return (volume / 1000000000).toFixed(2) + 'B';
  } else if (volume >= 1000000) {
    return (volume / 1000000).toFixed(2) + 'M';
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(2) + 'K';
  } else {
    return volume.toFixed(2);
  }
}

export function formatPercentage(percentage) {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(2)}%`;
}

// Trendline persistence functions
export function saveTrendlines(trendlines) {
  try {
    const dataToSave = trendlines.map(({ series, ...rest }) => rest);
    localStorage.setItem("tradingChart_trendlines", JSON.stringify(dataToSave));
    console.log(`💾 Saved ${dataToSave.length} trendlines to localStorage`);
  } catch (error) {
    console.error("Failed to save trendlines:", error);
  }
}

export function loadTrendlines() {
  try {
    const saved = localStorage.getItem("tradingChart_trendlines");
    const trendlines = saved ? JSON.parse(saved) : [];
    console.log(`📂 Loaded ${trendlines.length} trendlines from localStorage`);
    return trendlines;
  } catch (error) {
    console.error("Failed to load trendlines:", error);
    return [];
  }
}

export function formatTimestamp(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
}

export function calculateSlope(start, end) {
  const timeDiff = end.time - start.time;
  const priceDiff = end.price - start.price;
  return timeDiff !== 0 ? priceDiff / timeDiff : 0;
}