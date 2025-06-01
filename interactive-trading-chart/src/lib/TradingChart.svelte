<script>
  import { onMount, onDestroy } from 'svelte';
  import { 
    fetchBinanceData,
    get24hrStats,
    saveTrendlines, 
    loadTrendlines,
    DEFAULT_SYMBOL,
    DEFAULT_INTERVAL,
    INTERVALS,
    TRADING_PAIRS,
    formatPrice,
    formatVolume,
    formatPercentage,
    validateTrendline,
    distanceToLine
  } from './utils.js';

  let { oncoordinatesupdate } = $props();

  // Chart elements
  let chartContainer;
  let chart = null;
  let candlestickSeries = null;
  let volumeSeries = null;

  // Market data state
  let currentSymbol = $state(DEFAULT_SYMBOL);
  let currentInterval = $state(DEFAULT_INTERVAL);
  let isLoading = $state(false);
  let dataStatus = $state('Initializing...');
  let chartData = $state([]);
  let marketStats = $state(null);
  let lastUpdate = $state(null);
  
  // Enhanced trendline management with drag support
  let trendlines = $state([]);
  let isDrawing = $state(false);
  let currentTrendline = $state(null);
  let clickCount = $state(0);
  let selectedTrendlineId = $state(null);
  let hoveredTrendlineId = $state(null);
  
  // Immediate state tracking variables (not reactive)
  let isDrawingImmediate = false;
  let clickCountImmediate = 0;
  let currentTrendlineImmediate = null;
  
  // Drag state management
  let isDragging = $state(false);
  let dragTrendlineId = $state(null);
  let dragPoint = $state(null); // 'start' or 'end'
  let dragStartPos = $state(null);
  let lastMousePos = $state({ x: 0, y: 0 });
  
  // Trendline colors
  let trendlineColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  let colorIndex = 0;

  // Trendline delete buttons
  let deleteButtons = $state([]);

  // Cleanup function
  let cleanupFunctions = [];

  // Debug logging function
  function debugLog(message, data) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = data ? `${message}: ${JSON.stringify(data)}` : message;
    console.log(`[${timestamp}] ${logMessage}`);
  }

  // Function to notify parent of coordinate changes
  function notifyCoordinateUpdate() {
    const coordinateData = {
      coordinates: trendlines.map(({ series, ...rest }) => rest),
      selectedTrendline: selectedTrendlineId ? trendlines.find(t => t.id === selectedTrendlineId) : null
    };
    
    console.log('Dispatching coordinatesupdate event with data:', coordinateData);
    if (oncoordinatesupdate) {
      oncoordinatesupdate(coordinateData);
    }
  }

  onMount(() => {
    console.log('TradingChart mounted');
    
    let initAttempts = 0;
    const maxAttempts = 50; // 5 seconds total
    
    const checkAndInit = () => {
      initAttempts++;
      console.log(`Attempt ${initAttempts}: Checking for LightweightCharts...`);
      
      if (typeof window !== 'undefined' && window.LightweightCharts) {
        console.log('✅ LightweightCharts found:', window.LightweightCharts);
        console.log('Available methods:', Object.keys(window.LightweightCharts));
        setTimeout(() => initializeChart(), 100); // Small delay to ensure DOM is ready
        return;
      }
      
      if (initAttempts >= maxAttempts) {
        console.error('❌ Failed to load LightweightCharts after maximum attempts');
        dataStatus = 'Error: Chart library failed to load. Please refresh the page.';
        return;
      }
      
      console.log(`⏳ LightweightCharts not ready, retrying in 100ms... (${initAttempts}/${maxAttempts})`);
      setTimeout(checkAndInit, 100);
    };
    
    // Start checking immediately
    checkAndInit();

    // Auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      if (!isLoading && chart && candlestickSeries) loadMarketData();
    }, 5 * 60 * 1000);

    cleanupFunctions.push(() => clearInterval(refreshInterval));

    // Add global keyboard event listener
    const handleGlobalKeydown = (event) => {
      console.log('Global keydown:', event.key);
      handleKeydown(event);
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    cleanupFunctions.push(() => document.removeEventListener('keydown', handleGlobalKeydown));
  });

  onDestroy(() => {
    console.log('TradingChart destroying...');
    cleanupFunctions.forEach(cleanup => cleanup());
    
    if (chart) {
      try {
        chart.remove();
      } catch (error) {
        console.error('Error removing chart:', error);
      }
      chart = null;
    }
  });

  function initializeChart() {
    try {
      dataStatus = 'Creating chart...';
      console.log('🚀 Starting chart initialization...');
      
      // Verify library is available
      if (!window.LightweightCharts) {
        throw new Error('LightweightCharts library not available');
      }
      
      console.log('LightweightCharts object:', window.LightweightCharts);
      console.log('Available methods:', Object.keys(window.LightweightCharts));
      
      // Check for createChart method
      if (!window.LightweightCharts.createChart) {
        throw new Error('createChart method not available');
      }
      
      // Verify container exists and has dimensions
      if (!chartContainer) {
        throw new Error('Chart container element not found');
      }
      
      // Ensure container has proper dimensions
      const containerRect = chartContainer.getBoundingClientRect();
      console.log('Container dimensions:', containerRect);
      
      if (containerRect.width === 0 || containerRect.height === 0) {
        console.log('Container has zero dimensions, setting explicit size...');
        chartContainer.style.width = '100%';
        chartContainer.style.height = '500px';
        chartContainer.style.minWidth = '400px';
        chartContainer.style.minHeight = '500px';
      }

      const chartWidth = Math.max(chartContainer.clientWidth, 400);
      const chartHeight = 500;
      
      console.log(`Creating chart with dimensions: ${chartWidth}x${chartHeight}`);

      chart = window.LightweightCharts.createChart(chartContainer, {
        width: chartWidth,
        height: chartHeight,
        layout: {
          background: { color: '#1f2937' },
          textColor: '#d1d5db',
        },
        grid: {
          vertLines: { color: '#374151' },
          horzLines: { color: '#374151' },
        },
        crosshair: {
          mode: window.LightweightCharts.CrosshairMode?.Normal || 1,
          vertLine: { color: '#6b7280', width: 1, style: 2 },
          horzLine: { color: '#6b7280', width: 1, style: 2 },
        },
        rightPriceScale: {
          borderColor: '#4b5563',
          textColor: '#d1d5db',
        },
        timeScale: {
          borderColor: '#4b5563',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      if (!chart) {
        throw new Error('Failed to create chart instance');
      }

      console.log('✅ Chart instance created successfully');
      console.log('Chart methods:', Object.keys(chart));

      // Try different method names for adding candlestick series
      let candlestickMethod = null;
      const possibleMethods = [
        'addCandlestickSeries',
        'addCandleStickSeries', 
        'addOhlcSeries',
        'addBarSeries'
      ];

      for (const method of possibleMethods) {
        if (typeof chart[method] === 'function') {
          candlestickMethod = method;
          console.log(`Found candlestick method: ${method}`);
          break;
        }
      }

      if (!candlestickMethod) {
        console.error('Available chart methods:', Object.keys(chart));
        throw new Error('No candlestick series method found. Available methods: ' + Object.keys(chart).join(', '));
      }

      // Create candlestick series using the found method
      candlestickSeries = chart[candlestickMethod]({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderDownColor: '#ef4444',
        borderUpColor: '#10b981',
        wickDownColor: '#ef4444',
        wickUpColor: '#10b981',
      });

      if (!candlestickSeries) {
        throw new Error('Failed to create candlestick series');
      }

      console.log('✅ Candlestick series created successfully using method:', candlestickMethod);

      // Try different method names for adding histogram/volume series
      let histogramMethod = null;
      const possibleHistogramMethods = [
        'addHistogramSeries',
        'addVolumeSeries',
        'addBarSeries'
      ];

      for (const method of possibleHistogramMethods) {
        if (typeof chart[method] === 'function') {
          histogramMethod = method;
          console.log(`Found histogram method: ${method}`);
          break;
        }
      }

      if (histogramMethod) {
        // Create volume series
        volumeSeries = chart[histogramMethod]({
          color: '#26a69a',
          priceFormat: { type: 'volume' },
          priceScaleId: '',
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        if (volumeSeries) {
          console.log('✅ Volume series created successfully using method:', histogramMethod);
        } else {
          console.warn('⚠️ Failed to create volume series, continuing without it');
        }
      } else {
        console.warn('⚠️ No histogram method found, continuing without volume series');
      }

      dataStatus = 'Chart initialized successfully';
      
      // Set up event handlers
      chart.subscribeClick(handleChartClick);
      
      // Add mouse event listeners for drag functionality
      chartContainer.addEventListener('mousedown', handleMouseDown);
      chartContainer.addEventListener('mousemove', handleMouseMove);
      chartContainer.addEventListener('mouseup', handleMouseUp);
      chartContainer.addEventListener('mouseleave', handleMouseLeave);
      
      const handleResize = () => {
        if (chart && chartContainer) {
          const newWidth = Math.max(chartContainer.clientWidth, 400);
          chart.applyOptions({ width: newWidth });
          chart.timeScale().fitContent();
          updateDeleteButtonPositions();
        }
      };
      window.addEventListener('resize', handleResize);
      cleanupFunctions.push(() => window.removeEventListener('resize', handleResize));

      // Load market data
      console.log('📊 Loading initial market data...');
      loadMarketData();

      // Load saved trendlines
      const savedTrendlines = loadTrendlines();
      if (savedTrendlines.length > 0) {
        console.log(`📂 Loading ${savedTrendlines.length} saved trendlines`);
        trendlines = savedTrendlines.filter(validateTrendline);
        setTimeout(() => {
          drawAllTrendlines();
          notifyCoordinateUpdate();
        }, 1500);
      }

    } catch (error) {
      console.error('❌ Chart initialization failed:', error);
      dataStatus = `Error: ${error.message}`;
      
      // Try to reinitialize after a delay
      setTimeout(() => {
        console.log('🔄 Retrying chart initialization...');
        initializeChart();
      }, 2000);
    }
  }

  async function loadMarketData() {
    if (!chart || !candlestickSeries) {
      console.log('Chart or candlestick series not ready, skipping data load');
      dataStatus = 'Error: Chart not fully initialized';
      return;
    }

    isLoading = true;
    dataStatus = `Loading ${currentSymbol} ${currentInterval} data...`;
    console.log(`Loading market data for ${currentSymbol} ${currentInterval}`);
    
    try {
      const candleData = await fetchBinanceData(currentSymbol, currentInterval, 200);
      
      if (!candleData || candleData.length === 0) {
        throw new Error('No candle data received');
      }

      // Set candlestick data
      candlestickSeries.setData(candleData);
      
      // Set volume data if volume series exists
      if (volumeSeries) {
        const volumeData = candleData.map(candle => ({
          time: candle.time,
          value: candle.volume,
          color: candle.close >= candle.open ? '#10b981' : '#ef4444'
        }));
        volumeSeries.setData(volumeData);
      }
      
      chartData = candleData;
      
      chart.timeScale().fitContent();
      
      const stats = await get24hrStats(currentSymbol);
      marketStats = stats;
      
      lastUpdate = new Date();
      dataStatus = `✅ Loaded ${candleData.length} candles from Binance`;
      console.log(`Successfully loaded ${candleData.length} candles`);
      
      // Update delete button positions after data is loaded
      setTimeout(updateDeleteButtonPositions, 500);
      
    } catch (error) {
      console.error('Market data loading error:', error);
      dataStatus = `Error: ${error.message}`;
    } finally {
      isLoading = false;
    }
  }

  async function changeSymbol(newSymbol) {
    if (newSymbol !== currentSymbol && !isLoading) {
      console.log(`Changing symbol from ${currentSymbol} to ${newSymbol}`);
      currentSymbol = newSymbol;
      clearAllTrendlines();
      await loadMarketData();
    }
  }

  async function changeInterval(newInterval) {
    if (newInterval !== currentInterval && !isLoading) {
      console.log(`Changing interval from ${currentInterval} to ${newInterval}`);
      currentInterval = newInterval;
      await loadMarketData();
    }
  }

  // Enhanced click handler with immediate state tracking
  function handleChartClick(param) {
    if (!param.point || !param.time || !candlestickSeries || isDragging) {
      console.log('Chart click ignored - missing data or dragging');
      return;
    }

    try {
      const price = candlestickSeries.coordinateToPrice(param.point.y);
      const time = param.time;

      debugLog('Chart clicked', { 
        time, 
        price, 
        isDrawingState: isDrawing,
        isDrawingImmediate: isDrawingImmediate, 
        clickCount, 
        clickCountImmediate 
      });

      if (!isDrawingImmediate) {
        // Start drawing first point
        isDrawingImmediate = true;
        clickCountImmediate = 1;
        isDrawing = true;
        clickCount = 1;
        
        const newTrendline = {
          id: `trendline_${Date.now()}`,
          start: { time, price },
          end: null,
          series: null,
          color: trendlineColors[colorIndex % trendlineColors.length]
        };
        
        currentTrendlineImmediate = newTrendline;
        currentTrendline = newTrendline;
        
        dataStatus = 'Drawing trendline... Click to complete (1/2)';
        console.log('✅ Started drawing trendline:', newTrendline.id);
        console.log('📍 Start coordinates:', {
          timestamp: time,
          time: new Date(time * 1000).toISOString(),
          price: price
        });
        
      } else if (isDrawingImmediate && clickCountImmediate === 1) {
        // Complete the trendline with second point
        currentTrendlineImmediate.end = { time, price };
        
        if (validateTrendline(currentTrendlineImmediate)) {
          console.log('✅ Completing trendline:', currentTrendlineImmediate.id);
          console.log('End coordinates:', {
            timestamp: time,
            time: new Date(time * 1000).toISOString(),
            price: price
          });
          
          drawTrendline(currentTrendlineImmediate);
          trendlines = [...trendlines, currentTrendlineImmediate];
          saveTrendlines(trendlines);
          
          colorIndex++;
          
          console.log('✅ Trendline completed:', {
            id: currentTrendlineImmediate.id,
            start: { 
              timestamp: currentTrendlineImmediate.start.time,
              time: new Date(currentTrendlineImmediate.start.time * 1000).toISOString(), 
              price: currentTrendlineImmediate.start.price 
            },
            end: { 
              timestamp: currentTrendlineImmediate.end.time,
              time: new Date(currentTrendlineImmediate.end.time * 1000).toISOString(), 
              price: currentTrendlineImmediate.end.price 
            }
          });
          
          // Create delete button for the new trendline
          createDeleteButton(currentTrendlineImmediate);
          
          // Notify parent component
          notifyCoordinateUpdate();
        }

        // Reset drawing state
        isDrawingImmediate = false;
        clickCountImmediate = 0;
        currentTrendlineImmediate = null;
        isDrawing = false;
        clickCount = 0;
        currentTrendline = null;
        dataStatus = `✅ Loaded ${chartData.length} candles from Binance`;
      }
    } catch (error) {
      console.error('Chart click error:', error);
      isDrawingImmediate = false;
      clickCountImmediate = 0;
      currentTrendlineImmediate = null;
      isDrawing = false;
      clickCount = 0;
      currentTrendline = null;
    }
  }

  // Mouse event handlers for drag functionality
  function handleMouseDown(event) {
    if (isDrawingImmediate) return;
      
      const rect = chartContainer.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      console.log('Mouse down at:', { mouseX, mouseY });
      
      // Check if clicking near a trendline
      const clickedTrendline = findTrendlineNearPoint(mouseX, mouseY);
      
      if (clickedTrendline) {
        console.log('Starting drag on trendline:', clickedTrendline.trendline.id);
        isDragging = true;
        dragTrendlineId = clickedTrendline.trendline.id;
        dragPoint = clickedTrendline.point;
        dragStartPos = { x: mouseX, y: mouseY };
        lastMousePos = { x: mouseX, y: mouseY };
        
        // Disable chart interactions during drag
        chart.applyOptions({
          handleScroll: { mouseWheel: false, pressedMouseMove: false },
          handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false }
        });
        
        dataStatus = `Dragging trendline ${dragPoint} point...`;
        event.preventDefault();
      }
    }

  // Fix the handleMouseMove function to properly detect hovering over trendlines
  function handleMouseMove(event) {
    const rect = chartContainer.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    lastMousePos = { x: mouseX, y: mouseY };
    
    // Only log every 10th mouse move to reduce spam
    if (Math.random() < 0.1) {
      console.log('🖱️ Mouse move:', { mouseX, mouseY, trendlineCount: trendlines.length });
    }
    
    if (isDragging && dragTrendlineId && candlestickSeries) {
      try {
        // Convert mouse position to chart coordinates
        const time = chart.timeScale().coordinateToTime(mouseX);
        const price = candlestickSeries.coordinateToPrice(mouseY);
        
        if (time && !isNaN(price)) {
          // Update trendline coordinates
          updateTrendlinePosition(dragTrendlineId, dragPoint, time, price);
        }
      } catch (error) {
        console.error('Error during drag:', error);
      }
      event.preventDefault();
    } else {
      // Check for trendline hover
      const hoveredTrendline = findTrendlineNearPoint(mouseX, mouseY);
      
      if (hoveredTrendline) {
        console.log('🎯 HOVERING OVER TRENDLINE:', hoveredTrendline.trendline.id);
        hoveredTrendlineId = hoveredTrendline.trendline.id;
        
        if (chartContainer) {
          chartContainer.classList.add('hovering');
          chartContainer.classList.remove('dragging');
          console.log('✅ Added hovering class');
        }
      } else {
        if (hoveredTrendlineId) {
          console.log('❌ No longer hovering over trendline');
        }
        hoveredTrendlineId = null;
        
        if (chartContainer) {
          chartContainer.classList.remove('hovering');
          if (!isDragging) {
            chartContainer.classList.remove('dragging');
          }
        }
      }
      
      // Update delete button visibility
      updateDeleteButtonVisibility();
    }
  }

    function handleMouseUp(event) {
    if (isDragging && dragTrendlineId) {
      console.log('Ending drag for trendline:', dragTrendlineId);
      
      // Re-enable chart interactions
      chart.applyOptions({
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
      });
      
      // Save updated trendlines
      saveTrendlines(trendlines);
      
      // Log updated coordinates after drag
      const updatedTrendline = trendlines.find(t => t.id === dragTrendlineId);
      if (updatedTrendline) {
        console.log('🔄 TRENDLINE UPDATED AFTER DRAG:');
        console.log('=====================================');
        console.log('Trendline ID:', updatedTrendline.id);
        console.log('New Start Point:');
        console.log('  - Timestamp:', updatedTrendline.start.time);
        console.log('  - Date/Time:', new Date(updatedTrendline.start.time * 1000).toISOString());
        console.log('  - Price:', updatedTrendline.start.price);
        console.log('New End Point:');
        console.log('  - Timestamp:', updatedTrendline.end.time);
        console.log('  - Date/Time:', new Date(updatedTrendline.end.time * 1000).toISOString());
        console.log('  - Price:', updatedTrendline.end.price);
        console.log('=====================================');
        
        selectedTrendlineId = updatedTrendline.id;
        notifyCoordinateUpdate();
        
        // Update delete button position
        updateDeleteButtonPositions();
        
        // Show drag completion in status
        dataStatus = `🔄 Trendline ${updatedTrendline.id.slice(-8)} repositioned - coordinates logged`;
        setTimeout(() => {
          dataStatus = `✅ Loaded ${chartData.length} candles from Binance`;
        }, 3000);
      }
    }
    
    isDragging = false;
    dragTrendlineId = null;
    dragPoint = null;
    dragStartPos = null;
    if (chartContainer) {
      chartContainer.classList.remove('hovering');
      chartContainer.classList.remove('dragging');
    }
  }

    function handleMouseLeave(event) {
      handleMouseUp(event);
      hoveredTrendlineId = null;
      updateDeleteButtonVisibility();
    }

  // Improve the findTrendlineNearPoint function with better debugging
  function findTrendlineNearPoint(mouseX, mouseY) {
    const threshold = 25; // Even larger threshold for testing
    
    console.log(`🔍 Checking ${trendlines.length} trendlines for proximity to mouse (${mouseX}, ${mouseY})`);
    
    if (trendlines.length === 0) {
      console.log('❌ No trendlines exist');
      return null;
    }
    
    if (!chart || !candlestickSeries) {
      console.log('❌ Chart or candlestick series not available');
      return null;
    }
    
    for (let i = 0; i < trendlines.length; i++) {
      const trendline = trendlines[i];
      console.log(`Checking trendline ${i}:`, {
        id: trendline.id,
        hasSeries: !!trendline.series,
        start: trendline.start,
        end: trendline.end
      });
      
      if (!trendline.series) {
        console.log(`❌ Trendline ${i} has no series, skipping`);
        continue;
      }
      
      try {
        // Convert trendline coordinates to pixel positions
        const startX = chart.timeScale().timeToCoordinate(trendline.start.time);
        const startY = candlestickSeries.priceToCoordinate(trendline.start.price);
        const endX = chart.timeScale().timeToCoordinate(trendline.end.time);
        const endY = candlestickSeries.priceToCoordinate(trendline.end.price);
        
        console.log(`Trendline ${i} pixel coordinates:`, { 
          startX, startY, endX, endY,
          startTime: trendline.start.time,
          startPrice: trendline.start.price,
          endTime: trendline.end.time,
          endPrice: trendline.end.price
        });
        
        if (startX === null || startY === null || endX === null || endY === null) {
          console.log(`❌ Trendline ${i} has null coordinates, skipping`);
          continue;
        }
        
        // Check if coordinates are reasonable (within chart bounds)
        const chartRect = chartContainer.getBoundingClientRect();
        if (startX < 0 || startX > chartRect.width || endX < 0 || endX > chartRect.width ||
            startY < 0 || startY > chartRect.height || endY < 0 || endY > chartRect.height) {
          console.log(`⚠️ Trendline ${i} coordinates outside chart bounds`);
        }
        
        // Check distance to start point
        const distToStart = Math.sqrt(Math.pow(mouseX - startX, 2) + Math.pow(mouseY - startY, 2));
        console.log(`📍 Distance to start point: ${distToStart.toFixed(2)}px (threshold: ${threshold}px)`);
        if (distToStart <= threshold) {
          console.log(`✅ FOUND! Trendline at start point! Distance: ${distToStart.toFixed(2)}px`);
          return { trendline, point: 'start' };
        }
        
        // Check distance to end point
        const distToEnd = Math.sqrt(Math.pow(mouseX - endX, 2) + Math.pow(mouseY - endY, 2));
        console.log(`📍 Distance to end point: ${distToEnd.toFixed(2)}px (threshold: ${threshold}px)`);
        if (distToEnd <= threshold) {
          console.log(`✅ FOUND! Trendline at end point! Distance: ${distToEnd.toFixed(2)}px`);
          return { trendline, point: 'end' };
        }
        
        // Check distance to line (simplified calculation)
        const lineLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        if (lineLength > 0) {
          // Vector from start to end
          const lineVecX = (endX - startX) / lineLength;
          const lineVecY = (endY - startY) / lineLength;
          
          // Vector from start to mouse
          const mouseVecX = mouseX - startX;
          const mouseVecY = mouseY - startY;
          
          // Project mouse vector onto line vector
          const projection = mouseVecX * lineVecX + mouseVecY * lineVecY;
          const clampedProjection = Math.max(0, Math.min(lineLength, projection));
          
          // Find closest point on line
          const closestX = startX + clampedProjection * lineVecX;
          const closestY = startY + clampedProjection * lineVecY;
          
          // Distance from mouse to closest point on line
          const distToLine = Math.sqrt(Math.pow(mouseX - closestX, 2) + Math.pow(mouseY - closestY, 2));
          console.log(`📏 Distance to line: ${distToLine.toFixed(2)}px (threshold: ${threshold}px)`);
          
          if (distToLine <= threshold) {
            console.log(`✅ FOUND! Trendline on line! Distance: ${distToLine.toFixed(2)}px`);
            return { trendline, point: 'line' };
          }
        }
      } catch (error) {
        console.error(`❌ Error checking trendline ${i} proximity:`, error);
      }
    }
    
    console.log('❌ No trendline found near mouse position');
    return null;
  }

    // Update trendline position during drag
    function updateTrendlinePosition(trendlineId, point, newTime, newPrice) {
      const trendlineIndex = trendlines.findIndex(t => t.id === trendlineId);
      if (trendlineIndex === -1) return;
      
      const trendline = trendlines[trendlineIndex];
      
      if (point === 'start') {
        trendline.start = { time: newTime, price: newPrice };
      } else if (point === 'end') {
        trendline.end = { time: newTime, price: newPrice };
      } else if (point === 'line') {
        // Move entire line
        const deltaTime = newTime - (trendline.start.time + trendline.end.time) / 2;
        const deltaPrice = newPrice - (trendline.start.price + trendline.end.price) / 2;
        
        trendline.start.time += deltaTime;
        trendline.start.price += deltaPrice;
        trendline.end.time += deltaTime;
        trendline.end.price += deltaPrice;
      }
      
      // Validate and redraw
      if (validateTrendline(trendline)) {
        redrawTrendline(trendline);
        trendlines[trendlineIndex] = trendline;
      }
    }

    // Redraw a single trendline
    function redrawTrendline(trendlineData) {
      if (!chart || !validateTrendline(trendlineData)) return;
      
      // Remove existing series
      if (trendlineData.series) {
        chart.removeSeries(trendlineData.series);
      }
      
      // Create new series
      const lineSeries = chart.addLineSeries({
        color: trendlineData.color || '#3b82f6',
        lineWidth: 3, // Increased from 2 to 3 for better visibility
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
      trendlineData.series = lineSeries;
      
      // Add click handlers
      setupTrendlineEvents(lineSeries, trendlineData);
      
      // Update delete button position
      updateDeleteButtonPositions();
    }

  // Fixed drawTrendline function
  function drawTrendline(trendlineData) {
    if (!chart || !validateTrendline(trendlineData)) {
      console.error('Cannot draw trendline - invalid data or no chart');
      return false;
    }

    console.log('🎨 Drawing trendline:', trendlineData.id);

    try {
      const lineSeries = chart.addLineSeries({
        color: trendlineData.color || '#3b82f6',
        lineWidth: 3,
        lineStyle: 0,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const lineData = [
        { time: trendlineData.start.time, value: trendlineData.start.price },
        { time: trendlineData.end.time, value: trendlineData.end.price }
      ];

      console.log('📊 Line data:', lineData);
      lineSeries.setData(lineData);
      trendlineData.series = lineSeries;
      
      setupTrendlineEvents(lineSeries, trendlineData);
      
      console.log('✅ Trendline drawn successfully');
      return true;
    } catch (error) {
      console.error('Error drawing trendline:', error);
      return false;
    }
  }

  // Fixed setupTrendlineEvents function
  function setupTrendlineEvents(lineSeries, trendlineData) {
    // We can't use subscribeClick on line series, so we'll handle selection through the UI
    console.log('Setting up trendline events for:', trendlineData.id);
    
    // We can still log coordinates for debugging
    console.log('📊 TRENDLINE COORDINATES:');
    console.log('Trendline ID:', trendlineData.id);
    console.log('Start Point:');
    console.log('  - Timestamp:', trendlineData.start.time);
    console.log('  - Date/Time:', new Date(trendlineData.start.time * 1000).toISOString());
    console.log('  - Price:', trendlineData.start.price);
    console.log('End Point:');
    console.log('  - Timestamp:', trendlineData.end.time);
    console.log('  - Date/Time:', new Date(trendlineData.end.time * 1000).toISOString());
    console.log('  - Price:', trendlineData.end.price);
  }

  function drawAllTrendlines() {
    console.log(`Drawing ${trendlines.length} trendlines`);
    trendlines.forEach(trendline => {
      if (!trendline.series && validateTrendline(trendline)) {
        drawTrendline(trendline);
        createDeleteButton(trendline);
      }
    });
    updateDeleteButtonPositions();
  }

  function deleteTrendline(trendlineId) {
    console.log('🗑️ Deleting trendline:', trendlineId);
    const trendlineIndex = trendlines.findIndex(t => t.id === trendlineId);
    if (trendlineIndex !== -1) {
      const trendline = trendlines[trendlineIndex];
      if (trendline.series) {
        chart.removeSeries(trendline.series);
      }
      trendlines = trendlines.filter(t => t.id !== trendlineId);
      saveTrendlines(trendlines);
      
      if (selectedTrendlineId === trendlineId) {
        selectedTrendlineId = null;
      }
      
      // Remove delete button
      removeDeleteButton(trendlineId);
      
      notifyCoordinateUpdate();
      console.log('✅ Trendline deleted successfully');
    }
  }

  function clearAllTrendlines() {
    console.log('🗑️ Clearing all trendlines');
    trendlines.forEach(t => {
      if (t.series) chart.removeSeries(t.series);
    });
    trendlines = [];
    selectedTrendlineId = null;
    saveTrendlines([]);
    
    // Remove all delete buttons
    deleteButtons.forEach(btn => {
      if (btn && btn.parentNode) {
        btn.parentNode.removeChild(btn);
      }
    });
    deleteButtons = [];
    
    notifyCoordinateUpdate();
    console.log('✅ All trendlines cleared');
  }

    function handleKeydown(event) {
      console.log('Keydown event:', event.key, 'Selected:', selectedTrendlineId);
      
      if (event.key === 'Delete' && selectedTrendlineId) {
        console.log('Deleting selected trendline:', selectedTrendlineId);
        deleteTrendline(selectedTrendlineId);
        selectedTrendlineId = null;
        event.preventDefault();
      } else if (event.key === 'Escape') {
        if (isDrawingImmediate) {
          console.log('Canceling drawing mode');
          isDrawingImmediate = false;
          clickCountImmediate = 0;
          currentTrendlineImmediate = null;
          isDrawing = false;
          clickCount = 0;
          currentTrendline = null;
          dataStatus = `✅ Loaded ${chartData.length} candles from Binance`;
        }
        if (isDragging) {
          console.log('Canceling drag mode');
          handleMouseUp(new MouseEvent('mouseup'));
        }
        event.preventDefault();
      }
    }
    
  // Delete button functionality
  function createDeleteButton(trendline) {
    if (!chartContainer) return;
    
    const button = document.createElement('button');
    button.className = 'absolute hidden bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg transition-all z-50';
    button.innerHTML = '×';
    button.style.fontSize = '16px';
    button.style.fontWeight = 'bold';
    button.style.cursor = 'pointer';
    button.dataset.trendlineId = trendline.id;
    button.title = 'Delete trendline';
    
    button.onclick = (e) => {
      e.stopPropagation();
      console.log('🗑️ Deleting trendline via hover button:', trendline.id);
      deleteTrendline(trendline.id);
    };
    
    chartContainer.appendChild(button);
    deleteButtons = [...deleteButtons, button];
    
    console.log('✅ Created delete button for trendline:', trendline.id);
  }

  function updateDeleteButtonPositions() {
    if (!chart || !candlestickSeries || !chartContainer) return;
    
    deleteButtons.forEach(button => {
      const trendlineId = button.dataset.trendlineId;
      const trendline = trendlines.find(t => t.id === trendlineId);
      
      if (!trendline) {
        if (button.parentNode) {
          button.parentNode.removeChild(button);
        }
        return;
      }
      
      try {
        // Calculate midpoint of trendline
        const startX = chart.timeScale().timeToCoordinate(trendline.start.time);
        const startY = candlestickSeries.priceToCoordinate(trendline.start.price);
        const endX = chart.timeScale().timeToCoordinate(trendline.end.time);
        const endY = candlestickSeries.priceToCoordinate(trendline.end.price);
        
        if (startX === null || startY === null || endX === null || endY === null) return;
        
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        
        // Position button above midpoint
        button.style.left = `${midX - 12}px`;
        button.style.top = `${midY - 24}px`;
      } catch (error) {
        console.error('Error positioning delete button:', error);
      }
    });
  }

  function updateDeleteButtonVisibility() {
    deleteButtons.forEach(button => {
      const trendlineId = button.dataset.trendlineId;
      if (trendlineId === hoveredTrendlineId || trendlineId === selectedTrendlineId) {
        button.classList.remove('hidden');
      } else {
        button.classList.add('hidden');
      }
    });
  }

  function removeDeleteButton(trendlineId) {
    const buttonIndex = deleteButtons.findIndex(btn => btn.dataset.trendlineId === trendlineId);
    if (buttonIndex !== -1) {
      const button = deleteButtons[buttonIndex];
      if (button.parentNode) {
        button.parentNode.removeChild(button);
      }
      deleteButtons = deleteButtons.filter(btn => btn.dataset.trendlineId !== trendlineId);
    }
  }
</script>

<style>
  :global(.chart-container) {
    cursor: crosshair !important;
  }
  
  :global(.chart-container.hovering) {
    cursor: grab !important;
  }
  
  :global(.chart-container.dragging) {
    cursor: grabbing !important;
  }
</style>

<div class="space-y-4">
  <!-- Market Controls -->
  <div class="bg-gray-800 rounded-lg p-4">
    <div class="flex flex-wrap gap-4 items-center justify-between">
      <div class="flex flex-wrap gap-4 items-center">
        <!-- Symbol Selector -->
        <div class="flex flex-col">
          <label for="symbol-select" class="text-xs text-gray-400 mb-1 font-medium">Trading Pair</label>
          <select 
            id="symbol-select"
            bind:value={currentSymbol} 
            onchange={() => changeSymbol(currentSymbol)}
            class="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          >
            {#each TRADING_PAIRS as pair}
              <option value={pair.symbol}>{pair.symbol} - {pair.name}</option>
            {/each}
          </select>
        </div>

        <!-- Interval Selector -->
        <div class="flex flex-col">
          <label for="interval-select" class="text-xs text-gray-400 mb-1 font-medium">Time Interval</label>
          <select 
            id="interval-select"
            bind:value={currentInterval} 
            onchange={() => changeInterval(currentInterval)}
            class="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          >
            {#each Object.entries(INTERVALS) as [value, label]}
              <option value={value}>{label}</option>
            {/each}
          </select>
        </div>

        <!-- Refresh Button -->
        <div class="flex flex-col">
          <label class="text-xs text-gray-400 mb-1 font-medium" for="refresh-button">&nbsp;</label>
          <button
            id="refresh-button"
            onclick={loadMarketData}
            disabled={isLoading}
            class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            {#if isLoading}
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Loading...
            {:else}
              🔄 Refresh
            {/if}
          </button>
        </div>

        <!-- Trendline Controls -->
        <div class="flex flex-col">
          <label class="text-xs text-gray-400 mb-1 font-medium">Trendlines</label>
          <div class="flex gap-2">
            <button
              onclick={clearAllTrendlines}
              disabled={trendlines.length === 0}
              class="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              Clear All ({trendlines.length})
            </button>
            
            {#if selectedTrendlineId}
              <button
                onclick={() => {
                  deleteTrendline(selectedTrendlineId);
                  selectedTrendlineId = null;
                }}
                class="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
              >
                Delete Selected
              </button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Market Stats -->
      {#if marketStats}
        <div class="flex flex-wrap gap-4 text-sm">
          <div class="text-center">
            <div class="text-gray-400 text-xs">Price</div>
            <div class="font-bold text-lg">${formatPrice(marketStats.lastPrice, currentSymbol)}</div>
          </div>
          <div class="text-center">
            <div class="text-gray-400 text-xs">24h Change</div>
            <div class="font-bold {marketStats.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}">
              {formatPercentage(marketStats.priceChangePercent)}
            </div>
          </div>
          <div class="text-center">
            <div class="text-gray-400 text-xs">24h Volume</div>
            <div class="font-bold">{formatVolume(marketStats.volume)}</div>
          </div>
          <div class="text-center">
            <div class="text-gray-400 text-xs">24h High</div>
            <div class="font-bold text-green-400">${formatPrice(marketStats.highPrice, currentSymbol)}</div>
          </div>
          <div class="text-center">
            <div class="text-gray-400 text-xs">24h Low</div>
            <div class="font-bold text-red-400">${formatPrice(marketStats.lowPrice, currentSymbol)}</div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Status Bar -->
  <div class="bg-gray-700 p-3 rounded-lg text-sm flex justify-between items-center">
    <div class="flex items-center gap-4">
      <span>Status: {dataStatus}</span>
      {#if lastUpdate}
        <span class="text-gray-400">Last updated: {lastUpdate.toLocaleTimeString()}</span>
      {/if}
      {#if isDrawing}
        <span class="text-blue-400 font-medium animate-pulse">
          🎯 Drawing mode - Click to complete ({clickCount}/2)
        </span>
      {/if}
      {#if isDragging}
        <span class="text-purple-400 font-medium animate-pulse">
          🔄 Dragging trendline...
        </span>
      {/if}
      {#if selectedTrendlineId}
        <span class="text-yellow-400 font-medium">
          🎯 Selected: {selectedTrendlineId.slice(-8)}
        </span>
      {/if}
    </div>
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full {isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}"></div>
        <span class="text-xs">{isLoading ? 'Loading' : 'Live'}</span>
      </div>
      {#if trendlines.length > 0}
        <div class="text-xs bg-blue-600 px-2 py-1 rounded-full">
          {trendlines.length} trendline{trendlines.length !== 1 ? 's' : ''}
        </div>
      {/if}
    </div>
  </div>

  <!-- Chart Container -->
  <div class="relative bg-gray-800 rounded-lg p-4">
    <div 
      bind:this={chartContainer} 
      class="w-full h-[500px] rounded-lg overflow-hidden chart-container"
      style="width: 100%; height: 500px;"
    ></div>
    
    {#if isLoading}
      <div class="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center rounded-lg">
        <div class="text-white text-center">
          <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div class="text-lg font-medium">Loading {currentSymbol} data...</div>
        </div>
      </div>
    {/if}

    <!-- Instructions overlay for empty state -->
    {#if trendlines.length === 0 && !isLoading}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="bg-gray-800 bg-opacity-90 text-white p-6 rounded-lg text-center border border-gray-600">
          <div class="text-4xl mb-3">📈</div>
          <div class="text-lg font-medium mb-2">Interactive Trendline Drawing</div>
          <div class="text-sm text-gray-400 space-y-1">
            <div>• Click twice to draw a trendline</div>
            <div>• Drag endpoints or line to move</div>
            <div>• Double-click to view coordinates</div>
            <div>• Hover over trendline to see delete button</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Keyboard shortcuts info -->
    <div class="absolute top-4 right-4 bg-gray-700 bg-opacity-90 text-white p-2 rounded text-xs">
      <div class="font-medium mb-1">Keyboard Shortcuts:</div>
      <div>Delete: Remove selected trendline</div>
      <div>Escape: Cancel drawing/dragging</div>
    </div>
  </div>
  
  <!-- Coordinates Display -->
  {#if selectedTrendlineId}
    {@const trendline = trendlines.find(t => t.id === selectedTrendlineId)}
    {#if trendline}
      <div class="bg-gray-800 rounded-lg p-4 border border-gray-700 mt-4">
        <h3 class="text-lg font-medium text-blue-400 mb-3 flex items-center gap-2">
          📊 Trendline Coordinates
          <span class="text-sm text-gray-400">({selectedTrendlineId.slice(-8)})</span>
        </h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-gray-700 p-4 rounded-lg border-l-4 border-green-400">
            <div class="text-green-400 text-sm font-medium mb-2">📍 Start Point</div>
            <div class="space-y-1">
              <div class="text-sm"><span class="text-gray-400">Timestamp:</span> {trendline.start.time}</div>
              <div class="text-sm"><span class="text-gray-400">Date/Time:</span> {new Date(trendline.start.time * 1000).toLocaleString()}</div>
              <div class="text-lg font-bold"><span class="text-gray-400">Price:</span> ${trendline.start.price.toFixed(2)}</div>
            </div>
          </div>
          
          <div class="bg-gray-700 p-4 rounded-lg border-l-4 border-red-400">
            <div class="text-red-400 text-sm font-medium mb-2">🎯 End Point</div>
            <div class="space-y-1">
              <div class="text-sm"><span class="text-gray-400">Timestamp:</span> {trendline.end.time}</div>
              <div class="text-sm"><span class="text-gray-400">Date/Time:</span> {new Date(trendline.end.time * 1000).toLocaleString()}</div>
              <div class="text-lg font-bold"><span class="text-gray-400">Price:</span> ${trendline.end.price.toFixed(2)}</div>
            </div>
          </div>
        </div>
        
        <div class="mt-4 p-3 bg-blue-900 bg-opacity-30 rounded-lg border border-blue-600">
          <div class="text-blue-400 text-sm font-medium mb-1">💡 Usage Tips:</div>
          <div class="text-xs text-gray-300 space-y-1">
            <div>• Double-click any trendline to view its coordinates in console</div>
            <div>• Drag endpoints or the line to reposition (coordinates will be logged)</div>
            <div>• Hover over trendlines to see delete button</div>
            <div>• All trendlines are automatically saved to localStorage</div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>