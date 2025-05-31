<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { 
      fetchBinanceData,
      get24hrStats,
      getCurrentPrice,
      saveTrendlines, 
      loadTrendlines,
      DEFAULT_SYMBOL,
      DEFAULT_INTERVAL,
      INTERVALS,
      TRADING_PAIRS,
      formatPrice,
      formatVolume,
      formatPercentage
    } from './utils.js';
  
    const dispatch = createEventDispatcher();
  
    // Chart elements
    let chartContainer;
    let chart = null;
    let candlestickSeries = null;
    let volumeSeries = null;
  
    // Market data
    let currentSymbol = $state(DEFAULT_SYMBOL);
    let currentInterval = $state(DEFAULT_INTERVAL);
    let isLoading = $state(false);
    let dataStatus = $state('Initializing...');
    let chartData = $state([]);
    let marketStats = $state(null);
    let lastUpdate = $state(null);
    
    // Trendline management
    let trendlines = $state([]);
    let isDrawing = $state(false);
    let currentTrendline = null;
    let clickCount = $state(0);
    let selectedTrendlineId = $state(null);
  
    onMount(() => {
      const checkLibrary = () => {
        if (typeof window !== 'undefined' && window.LightweightCharts) {
          initializeChart();
        } else {
          setTimeout(checkLibrary, 100);
        }
      };
      checkLibrary();
  
      // Auto-refresh every 5 minutes
      const refreshInterval = setInterval(() => {
        if (!isLoading) {
          loadMarketData();
        }
      }, 5 * 60 * 1000);
  
      return () => clearInterval(refreshInterval);
    });
  
    function initializeChart() {
      try {
        dataStatus = 'Creating chart...';
        
        chart = window.LightweightCharts.createChart(chartContainer, {
          width: Math.max(chartContainer.clientWidth, 800),
          height: 500,
          layout: {
            background: { color: '#1f2937' },
            textColor: '#d1d5db',
          },
          grid: {
            vertLines: { color: '#374151' },
            horzLines: { color: '#374151' },
          },
          crosshair: {
            mode: 1,
          },
          rightPriceScale: {
            borderColor: '#4b5563',
          },
          timeScale: {
            borderColor: '#4b5563',
            timeVisible: true,
            secondsVisible: false,
          },
        });
  
        // Add candlestick series
        candlestickSeries = chart.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderDownColor: '#ef4444',
          borderUpColor: '#10b981',
          wickDownColor: '#ef4444',
          wickUpColor: '#10b981',
        });
  
        // Add volume series
        volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '',
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });
  
        dataStatus = 'Chart created successfully';
        
        // Load initial data
        loadMarketData();
  
        // Event handlers
        chart.subscribeClick(handleChartClick);
        
        const handleResize = () => {
          if (chart && chartContainer) {
            chart.applyOptions({ width: Math.max(chartContainer.clientWidth, 400) });
          }
        };
        window.addEventListener('resize', handleResize);
  
        // Load saved trendlines
        const savedTrendlines = loadTrendlines();
        if (savedTrendlines.length > 0) {
          trendlines = savedTrendlines;
          setTimeout(() => drawAllTrendlines(), 1000); // Wait for data to load
        }
  
      } catch (error) {
        console.error('Chart initialization error:', error);
        dataStatus = `Initialization error: ${error.message}`;
      }
    }
  
    async function loadMarketData() {
      if (!candlestickSeries || !volumeSeries) {
        console.log('Chart not ready for data loading');
        return;
      }
  
      isLoading = true;
      dataStatus = `Loading ${currentSymbol} ${currentInterval} data...`;
      
      try {
        console.log(`🔄 Loading market data: ${currentSymbol} ${currentInterval}`);
        
        // Fetch candlestick data from Binance
        const candleData = await fetchBinanceData(currentSymbol, currentInterval, 200);
        
        if (!candleData || candleData.length === 0) {
          throw new Error('No candle data received');
        }
  
        // Prepare volume data
        const volumeData = candleData.map(candle => ({
          time: candle.time,
          value: candle.volume,
          color: candle.close >= candle.open ? '#10b981' : '#ef4444'
        }));
        
        // Update chart
        candlestickSeries.setData(candleData);
        volumeSeries.setData(volumeData);
        chartData = candleData;
        
        // Fit chart to data
        chart.timeScale().fitContent();
        
        // Fetch market statistics
        const stats = await get24hrStats(currentSymbol);
        marketStats = stats;
        
        lastUpdate = new Date();
        dataStatus = `✅ Loaded ${candleData.length} candles from Binance`;
        
        console.log(`✅ Successfully loaded ${candleData.length} candles for ${currentSymbol}`);
        
      } catch (error) {
        console.error('❌ Market data loading error:', error);
        dataStatus = `Error: ${error.message}`;
      } finally {
        isLoading = false;
      }
    }
  
    async function changeSymbol(newSymbol) {
      if (newSymbol !== currentSymbol && !isLoading) {
        console.log(`🔄 Changing symbol from ${currentSymbol} to ${newSymbol}`);
        currentSymbol = newSymbol;
        
        // Clear existing trendlines when changing symbol
        clearAllTrendlines();
        
        await loadMarketData();
      }
    }
  
    async function changeInterval(newInterval) {
      if (newInterval !== currentInterval && !isLoading) {
        console.log(`🔄 Changing interval from ${currentInterval} to ${newInterval}`);
        currentInterval = newInterval;
        await loadMarketData();
      }
    }
  
    function handleChartClick(param) {
      if (!param.point || !param.time || !candlestickSeries) return;
  
      try {
        const price = candlestickSeries.coordinateToPrice(param.point.y);
        const time = param.time;
  
        if (!isDrawing) {
          isDrawing = true;
          clickCount = 1;
          currentTrendline = {
            id: Date.now().toString(),
            start: { time, price },
            end: null,
            series: null
          };
        } else if (clickCount === 1) {
          currentTrendline.end = { time, price };
          
          drawTrendline(currentTrendline);
          trendlines = [...trendlines, currentTrendline];
          saveTrendlines(trendlines);
          
          dispatch('coordinatesupdate', {
            coordinates: trendlines.map(({ series, ...rest }) => rest),
            selectedTrendline: null
          });
  
          isDrawing = false;
          clickCount = 0;
          currentTrendline = null;
        }
      } catch (error) {
        console.error('Chart click error:', error);
      }
    }
  
    function drawTrendline(trendlineData) {
      const lineSeries = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 0,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      });
  
      const lineData = [
        { time: trendlineData.start.time, value: trendlineData.start.price },
        { time: trendlineData.end.time, value: trendlineData.end.price }
      ];
  
      lineSeries.setData(lineData);
  
      const trendlineIndex = trendlines.findIndex(t => t.id === trendlineData.id);
      if (trendlineIndex !== -1) {
        trendlines[trendlineIndex].series = lineSeries;
      } else {
        trendlineData.series = lineSeries;
      }
  
      // Add click handlers
      lineSeries.subscribeClick((param) => {
        if (param.seriesData) {
          const trendline = trendlines.find(t => t.series === lineSeries);
          if (trendline) {
            selectedTrendlineId = trendline.id;
            dispatch('coordinatesupdate', {
              coordinates: trendlines.map(({ series, ...rest }) => rest),
              selectedTrendline: { ...trendline, series: undefined }
            });
          }
        }
      });
  
      // Double-click handler
      let lastClickTime = 0;
      lineSeries.subscribeClick((param) => {
        const currentTime = Date.now();
        if (currentTime - lastClickTime < 300) {
          const trendline = trendlines.find(t => t.series === lineSeries);
          if (trendline) {
            console.log('Trendline Coordinates:', {
              id: trendline.id,
              start: { time: new Date(trendline.start.time * 1000).toISOString(), price: trendline.start.price },
              end: { time: new Date(trendline.end.time * 1000).toISOString(), price: trendline.end.price }
            });
          }
        }
        lastClickTime = currentTime;
      });
    }
  
    function drawAllTrendlines() {
      trendlines.forEach(trendline => {
        if (!trendline.series) {
          drawTrendline(trendline);
        }
      });
    }
  
    function deleteTrendline(trendlineId) {
      const trendlineIndex = trendlines.findIndex(t => t.id === trendlineId);
      if (trendlineIndex !== -1) {
        const trendline = trendlines[trendlineIndex];
        if (trendline.series) {
          chart.removeSeries(trendline.series);
        }
        trendlines = trendlines.filter(t => t.id !== trendlineId);
        saveTrendlines(trendlines);
        
        dispatch('coordinatesupdate', {
          coordinates: trendlines.map(({ series, ...rest }) => rest),
          selectedTrendline: null
        });
      }
    }
  
    function clearAllTrendlines() {
      trendlines.forEach(t => {
        if (t.series) chart.removeSeries(t.series);
      });
      trendlines = [];
      saveTrendlines([]);
      dispatch('coordinatesupdate', { coordinates: [], selectedTrendline: null });
    }
  
    function handleKeydown(event) {
      if (event.key === 'Delete' && selectedTrendlineId) {
        deleteTrendline(selectedTrendlineId);
        selectedTrendlineId = null;
      }
    }
  </script>
  
  <svelte:window onkeydown={handleKeydown} />
  
  <div class="space-y-4">
    <!-- Market Controls -->
    <div class="flex flex-wrap gap-4 items-center justify-between bg-gray-800 p-4 rounded-lg">
      <div class="flex flex-wrap gap-4 items-center">
        <!-- Symbol Selector -->
        <div class="flex flex-col">
          <label class="text-xs text-gray-400 mb-1">Trading Pair</label>
          <select 
            bind:value={currentSymbol} 
            onchange={() => changeSymbol(currentSymbol)}
            class="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          >
            {#each TRADING_PAIRS as pair}
              <option value={pair}>{pair}</option>
            {/each}
          </select>
        </div>
  
        <!-- Interval Selector -->
        <div class="flex flex-col">
          <label class="text-xs text-gray-400 mb-1">Time Interval</label>
          <select 
            bind:value={currentInterval} 
            onchange={() => changeInterval(currentInterval)}
            class="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          >
            {#each Object.entries(INTERVALS) as [value, label]}
              <option value={value}>{label}</option>
            {/each}
          </select>
        </div>
  
        <!-- Refresh Button -->
        <div class="flex flex-col">
          <label class="text-xs text-gray-400 mb-1">&nbsp;</label>
          <button
            onclick={loadMarketData}
            disabled={isLoading}
            class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors flex items-center gap-2"
          >
            {#if isLoading}
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Loading...
            {:else}
              🔄 Refresh
            {/if}
          </button>
        </div>
      </div>
  
      <!-- Market Stats -->
      {#if marketStats}
        <div class="flex flex-wrap gap-4 text-sm">
          <div class="text-center">
            <div class="text-gray-400">Price</div>
            <div class="font-bold">${formatPrice(marketStats.lastPrice, currentSymbol)}</div>
          </div>
          <div class="text-center">
            <div class="text-gray-400">24h Change</div>
            <div class="font-bold {marketStats.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}">
              {formatPercentage(marketStats.priceChangePercent)}
            </div>
          </div>
          <div class="text-center">
            <div class="text-gray-400">24h Volume</div>
            <div class="font-bold">{formatVolume(marketStats.volume)}</div>
          </div>
          <div class="text-center">
            <div class="text-gray-400">24h High</div>
            <div class="font-bold text-green-400">${formatPrice(marketStats.highPrice, currentSymbol)}</div>
          </div>
          <div class="text-center">
            <div class="text-gray-400">24h Low</div>
            <div class="font-bold text-red-400">${formatPrice(marketStats.lowPrice, currentSymbol)}</div>
          </div>
        </div>
      {/if}
    </div>
  
    <!-- Status Bar -->
    <div class="bg-gray-700 p-2 rounded text-sm flex justify-between items-center">
      <div class="flex items-center gap-4">
        <span>Status: {dataStatus}</span>
        {#if lastUpdate}
          <span class="text-gray-400">Last updated: {lastUpdate.toLocaleTimeString()}</span>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full {isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}"></div>
        <span class="text-xs">{isLoading ? 'Loading' : 'Live'}</span>
      </div>
    </div>
  
    <!-- Chart Container -->
    <div class="relative bg-gray-800 rounded-lg p-4">
      <div 
        bind:this={chartContainer} 
        class="w-full h-[500px]"
        style="width: 100%; height: 500px;"
      ></div>
      
      {#if isLoading}
        <div class="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center rounded-lg">
          <div class="text-white text-center">
            <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <div>Loading {currentSymbol} data...</div>
          </div>
        </div>
      {/if}
  
      {#if isDrawing}
        <div class="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded text-sm">
          Click to complete trendline ({clickCount}/2)
        </div>
      {/if}
  
      {#if trendlines.length > 0}
        <div class="absolute top-4 right-4 space-y-2">
          <button
            onclick={clearAllTrendlines}
            class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            Clear All ({trendlines.length})
          </button>
          
          {#if selectedTrendlineId}
            <button
              onclick={() => {
                deleteTrendline(selectedTrendlineId);
                selectedTrendlineId = null;
              }}
              class="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm transition-colors block w-full"
            >
              Delete Selected
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>