<script>
    import TradingChart from '$lib/TradingChart.svelte';
    import '../app.css';
  
    let coordinates = $state([]);
    let selectedTrendline = $state(null);
  
    function handleCoordinatesUpdate(event) {
      coordinates = event.detail.coordinates;
      selectedTrendline = event.detail.selectedTrendline;
    }
  </script>
  
  <svelte:head>
    <title>Interactive Trading Chart - Live Binance Data</title>
    <meta name="description" content="Real-time cryptocurrency trading chart with trendline analysis using Binance API" />
  </svelte:head>
  
  <main class="min-h-screen bg-gray-900 text-white p-4">
    <div class="max-w-7xl mx-auto">
      <header class="mb-6">
        <h1 class="text-3xl font-bold text-center mb-2">
          📈 Interactive Trading Chart
        </h1>
        <p class="text-gray-400 text-center mb-2">
          Real-time cryptocurrency data powered by Binance API
        </p>
        <p class="text-gray-500 text-center text-sm">
          Click twice to draw a trendline • Double-click to view coordinates • Drag to move • Press Delete to remove
        </p>
      </header>
  
      <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <!-- Chart Container -->
        <div class="xl:col-span-3">
          <div class="bg-gray-800 rounded-lg p-4">
            <TradingChart oncoordinatesupdate={handleCoordinatesUpdate} />
          </div>
        </div>
  
        <!-- Sidebar with Controls and Info -->
        <div class="xl:col-span-1">
          <div class="bg-gray-800 rounded-lg p-4 space-y-6">
            
            <!-- Selected Trendline Info -->
            {#if selectedTrendline}
              <div class="p-3 bg-gray-700 rounded">
                <h3 class="font-medium text-blue-400 mb-3">📍 Selected Trendline</h3>
                <div class="text-sm space-y-2">
                  <div class="flex justify-between">
                    <span class="text-gray-400">ID:</span>
                    <span class="font-mono text-xs">{selectedTrendline.id}</span>
                  </div>
                  
                  <div class="border-t border-gray-600 pt-2">
                    <div class="text-gray-400 text-xs mb-1">Start Point</div>
                    <div class="text-xs">
                      📅 {new Date(selectedTrendline.start.time * 1000).toLocaleString()}
                    </div>
                    <div class="text-xs">
                      💰 ${selectedTrendline.start.price.toFixed(2)}
                    </div>
                  </div>
                  
                  <div class="border-t border-gray-600 pt-2">
                    <div class="text-gray-400 text-xs mb-1">End Point</div>
                    <div class="text-xs">
                      📅 {new Date(selectedTrendline.end.time * 1000).toLocaleString()}
                    </div>
                    <div class="text-xs">
                      💰 ${selectedTrendline.end.price.toFixed(2)}
                    </div>
                  </div>
                  
                  <div class="border-t border-gray-600 pt-2">
                    <div class="text-gray-400 text-xs mb-1">Price Change</div>
                    <div class="text-xs {selectedTrendline.end.price >= selectedTrendline.start.price ? 'text-green-400' : 'text-red-400'}">
                      {selectedTrendline.end.price >= selectedTrendline.start.price ? '📈' : '📉'} 
                      ${(selectedTrendline.end.price - selectedTrendline.start.price).toFixed(2)}
                      ({(((selectedTrendline.end.price - selectedTrendline.start.price) / selectedTrendline.start.price) * 100).toFixed(2)}%)
                    </div>
                  </div>
                </div>
              </div>
            {/if}
  
            <!-- All Trendlines List -->
            <div>
              <h3 class="font-medium text-green-400 mb-3 flex items-center gap-2">
                📊 All Trendlines 
                <span class="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                  {coordinates.length}
                </span>
              </h3>
              
              {#if coordinates.length === 0}
                <div class="text-center py-8">
                  <div class="text-4xl mb-2">📈</div>
                  <p class="text-gray-500 text-sm">No trendlines drawn yet</p>
                  <p class="text-gray-600 text-xs mt-1">Click twice on the chart to start</p>
                </div>
              {:else}
                <div class="max-h-64 overflow-y-auto space-y-2">
                  {#each coordinates as coord, index}
                    <div class="p-3 bg-gray-700 rounded text-xs hover:bg-gray-600 transition-colors">
                      <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-blue-300">Trendline {index + 1}</span>
                        <span class="text-gray-400">#{coord.id.slice(-4)}</span>
                      </div>
                      
                      <div class="space-y-1 text-gray-300">
                        <div class="flex justify-between">
                          <span>Start:</span>
                          <span>{new Date(coord.start.time * 1000).toLocaleDateString()}</span>
                        </div>
                        <div class="flex justify-between">
                          <span>End:</span>
                          <span>{new Date(coord.end.time * 1000).toLocaleDateString()}</span>
                        </div>
                        <div class="flex justify-between">
                          <span>Range:</span>
                          <span class="{coord.end.price >= coord.start.price ? 'text-green-400' : 'text-red-400'}">
                            ${Math.abs(coord.end.price - coord.start.price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
  
            <!-- Instructions -->
            <div class="border-t border-gray-700 pt-4">
              <h3 class="font-medium text-yellow-400 mb-3">📋 Instructions</h3>
              <ul class="text-xs text-gray-400 space-y-2">
                <li class="flex items-start gap-2">
                  <span class="text-blue-400">🖱️</span>
                  <span>Click twice on chart to draw trendline</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-green-400">👆</span>
                  <span>Double-click trendline to view details</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-purple-400">🔄</span>
                  <span>Drag trendlines to reposition them</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-red-400">🗑️</span>
                  <span>Press Delete key to remove selected</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-orange-400">💾</span>
                  <span>Trendlines auto-save to localStorage</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-cyan-400">🔄</span>
                  <span>Data refreshes every 5 minutes</span>
                </li>
              </ul>
            </div>
  
            <!-- API Status -->
            <div class="border-t border-gray-700 pt-4">
              <h3 class="font-medium text-cyan-400 mb-2">🌐 Data Source</h3>
              <div class="text-xs text-gray-400 space-y-1">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Binance API</span>
                </div>
                <div>Real-time cryptocurrency data</div>
                <div>Fallback to mock data if API unavailable</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>