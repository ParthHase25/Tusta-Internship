// Enhanced Binance API configuration with better error handling
const BINANCE_BASE_URL = "https://api.binance.com/api/v3"

// Default settings
export const DEFAULT_SYMBOL = "BTCUSDT"
export const DEFAULT_INTERVAL = "1h"

// Available intervals
export const INTERVALS = {
  "1m": "1 Minute",
  "3m": "3 Minutes",
  "5m": "5 Minutes",
  "15m": "15 Minutes",
  "30m": "30 Minutes",
  "1h": "1 Hour",
  "2h": "2 Hours",
  "4h": "4 Hours",
  "6h": "6 Hours",
  "8h": "8 Hours",
  "12h": "12 Hours",
  "1d": "1 Day",
  "3d": "3 Days",
  "1w": "1 Week",
  "1M": "1 Month",
}

// Enhanced trading pairs
export const TRADING_PAIRS = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "BNBUSDT", name: "BNB" },
  { symbol: "ADAUSDT", name: "Cardano" },
  { symbol: "SOLUSDT", name: "Solana" },
  { symbol: "XRPUSDT", name: "XRP" },
  { symbol: "DOTUSDT", name: "Polkadot" },
  { symbol: "DOGEUSDT", name: "Dogecoin" },
  { symbol: "AVAXUSDT", name: "Avalanche" },
  { symbol: "MATICUSDT", name: "Polygon" },
  { symbol: "LINKUSDT", name: "Chainlink" },
  { symbol: "UNIUSDT", name: "Uniswap" },
  { symbol: "LTCUSDT", name: "Litecoin" },
  { symbol: "BCHUSDT", name: "Bitcoin Cash" },
  { symbol: "FILUSDT", name: "Filecoin" },
]

/**
 * Enhanced fetch with retry logic and timeout
 */
export async function fetchBinanceData(symbol = DEFAULT_SYMBOL, interval = DEFAULT_INTERVAL, limit = 200) {
  const maxRetries = 3
  let lastError

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = `${BINANCE_BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`

      console.log(`🔄 Attempt ${attempt}/${maxRetries}: Fetching ${symbol} ${interval}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`)
      }

      const rawData = await response.json()

      if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error("Invalid response from Binance API")
      }

      const transformedData = rawData
        .map((kline) => ({
          time: Math.floor(kline[0] / 1000),
          open: Number.parseFloat(kline[1]),
          high: Number.parseFloat(kline[2]),
          low: Number.parseFloat(kline[3]),
          close: Number.parseFloat(kline[4]),
          volume: Number.parseFloat(kline[5]),
        }))
        .filter(
          (candle) =>
            !isNaN(candle.time) &&
            !isNaN(candle.open) &&
            !isNaN(candle.high) &&
            !isNaN(candle.low) &&
            !isNaN(candle.close) &&
            !isNaN(candle.volume) &&
            candle.high >= candle.low &&
            candle.high >= Math.max(candle.open, candle.close) &&
            candle.low <= Math.min(candle.open, candle.close),
        )

      console.log(`✅ Successfully processed ${transformedData.length} candles`)
      return transformedData
    } catch (error) {
      lastError = error
      console.error(`❌ Attempt ${attempt} failed:`, error.message)

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  console.error("❌ All attempts failed, using mock data")
  return generateMockData(symbol, limit)
}

/**
 * Get 24hr market statistics
 */
export async function get24hrStats(symbol = DEFAULT_SYMBOL) {
  try {
    const url = `${BINANCE_BASE_URL}/ticker/24hr?symbol=${symbol}`
    const response = await fetch(url, { timeout: 5000 })

    if (!response.ok) throw new Error(`Failed to fetch stats: ${response.statusText}`)

    const data = await response.json()
    return {
      symbol: data.symbol,
      priceChange: Number.parseFloat(data.priceChange),
      priceChangePercent: Number.parseFloat(data.priceChangePercent),
      lastPrice: Number.parseFloat(data.lastPrice),
      highPrice: Number.parseFloat(data.highPrice),
      lowPrice: Number.parseFloat(data.lowPrice),
      volume: Number.parseFloat(data.volume),
      openPrice: Number.parseFloat(data.openPrice),
    }
  } catch (error) {
    console.error("Error fetching 24hr stats:", error)
    return null
  }
}

/**
 * Generate realistic mock data
 */
export function generateMockData(symbol = DEFAULT_SYMBOL, limit = 200) {
  console.log(`🎭 Generating mock data for ${symbol}`)

  const data = []
  const basePrice = getBasePriceForSymbol(symbol)
  const volatility = getVolatilityForSymbol(symbol)

  let currentPrice = basePrice
  const now = Math.floor(Date.now() / 1000)
  const intervalSeconds = 3600 // 1 hour

  for (let i = limit - 1; i >= 0; i--) {
    const time = now - i * intervalSeconds
    const open = currentPrice

    const change = (Math.random() - 0.5) * volatility * currentPrice
    const close = Math.max(open + change, currentPrice * 0.01)

    const high = Math.max(open, close) + Math.random() * volatility * currentPrice * 0.3
    const low = Math.max(Math.min(open, close) - Math.random() * volatility * currentPrice * 0.3, currentPrice * 0.01)

    const volume = getBaseVolumeForSymbol(symbol) * (0.5 + Math.random())

    data.push({
      time,
      open: Number(open.toFixed(getPrecisionForSymbol(symbol))),
      high: Number(high.toFixed(getPrecisionForSymbol(symbol))),
      low: Number(low.toFixed(getPrecisionForSymbol(symbol))),
      close: Number(close.toFixed(getPrecisionForSymbol(symbol))),
      volume: Number(volume.toFixed(2)),
    })

    currentPrice = close
  }

  return data
}

// Helper functions
function getBasePriceForSymbol(symbol) {
  const prices = {
    BTCUSDT: 43000,
    ETHUSDT: 2300,
    BNBUSDT: 310,
    ADAUSDT: 0.38,
    SOLUSDT: 98,
    XRPUSDT: 0.52,
    DOTUSDT: 5.8,
    DOGEUSDT: 0.08,
    AVAXUSDT: 24,
    MATICUSDT: 0.73,
    LINKUSDT: 14.5,
    UNIUSDT: 6.2,
    LTCUSDT: 72,
    BCHUSDT: 234,
    FILUSDT: 4.1,
  }
  return prices[symbol] || 100
}

function getVolatilityForSymbol(symbol) {
  const volatilities = {
    BTCUSDT: 0.025,
    ETHUSDT: 0.035,
    BNBUSDT: 0.045,
    ADAUSDT: 0.055,
    SOLUSDT: 0.065,
    XRPUSDT: 0.045,
    DOTUSDT: 0.055,
    DOGEUSDT: 0.075,
    AVAXUSDT: 0.065,
    MATICUSDT: 0.055,
    LINKUSDT: 0.05,
    UNIUSDT: 0.06,
    LTCUSDT: 0.04,
    BCHUSDT: 0.045,
    FILUSDT: 0.06,
  }
  return volatilities[symbol] || 0.05
}

function getBaseVolumeForSymbol(symbol) {
  const volumes = {
    BTCUSDT: 1000000,
    ETHUSDT: 500000,
    BNBUSDT: 200000,
    ADAUSDT: 10000000,
    SOLUSDT: 300000,
    XRPUSDT: 50000000,
    DOTUSDT: 1000000,
    DOGEUSDT: 100000000,
    AVAXUSDT: 500000,
    MATICUSDT: 5000000,
    LINKUSDT: 800000,
    UNIUSDT: 600000,
    LTCUSDT: 400000,
    BCHUSDT: 300000,
    FILUSDT: 700000,
  }
  return volumes[symbol] || 1000000
}

function getPrecisionForSymbol(symbol) {
  if (["DOGEUSDT", "ADAUSDT", "XRPUSDT", "MATICUSDT"].includes(symbol)) {
    return 6
  }
  return 2
}

// Formatting functions
export function formatPrice(price, symbol = DEFAULT_SYMBOL) {
  const precision = getPrecisionForSymbol(symbol)
  return Number(price).toFixed(precision)
}

export function formatVolume(volume) {
  if (volume >= 1000000000) return (volume / 1000000000).toFixed(2) + "B"
  if (volume >= 1000000) return (volume / 1000000).toFixed(2) + "M"
  if (volume >= 1000) return (volume / 1000).toFixed(2) + "K"
  return volume.toFixed(2)
}

export function formatPercentage(percentage) {
  const sign = percentage >= 0 ? "+" : ""
  return `${sign}${percentage.toFixed(2)}%`
}

// Trendline persistence
export function saveTrendlines(trendlines) {
  try {
    const dataToSave = trendlines.map(({ series, ...rest }) => rest)
    localStorage.setItem("tradingChart_trendlines", JSON.stringify(dataToSave))
    console.log(`💾 Saved ${dataToSave.length} trendlines`)
    return true
  } catch (error) {
    console.error("Failed to save trendlines:", error)
    return false
  }
}

export function loadTrendlines() {
  try {
    const saved = localStorage.getItem("tradingChart_trendlines")
    const trendlines = saved ? JSON.parse(saved) : []
    console.log(`📂 Loaded ${trendlines.length} trendlines`)
    return trendlines
  } catch (error) {
    console.error("Failed to load trendlines:", error)
    return []
  }
}

export function formatTimestamp(timestamp) {
  return new Date(timestamp * 1000).toLocaleString()
}

export function calculateSlope(start, end) {
  const timeDiff = end.time - start.time
  const priceDiff = end.price - start.price
  return timeDiff !== 0 ? priceDiff / timeDiff : 0
}

export function validateTrendline(trendline) {
  if (!trendline?.start || !trendline?.end) return false

  const { start, end } = trendline
  return (
    !isNaN(start.time) &&
    !isNaN(start.price) &&
    !isNaN(end.time) &&
    !isNaN(end.price) &&
    start.time < end.time &&
    start.price > 0 &&
    end.price > 0
  )
}

// Distance calculation for drag detection
export function distanceToLine(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x
  const B = point.y - lineStart.y
  const C = lineEnd.x - lineStart.x
  const D = lineEnd.y - lineStart.y

  const dot = A * C + B * D
  const lenSq = C * C + D * D

  if (lenSq === 0) return Math.sqrt(A * A + B * B)

  let param = dot / lenSq
  param = Math.max(0, Math.min(1, param))

  const xx = lineStart.x + param * C
  const yy = lineStart.y + param * D

  const dx = point.x - xx
  const dy = point.y - yy

  return Math.sqrt(dx * dx + dy * dy)
}
