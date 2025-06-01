<script>
  import { browser } from '$app/environment';
  import TradingChart from '$lib/TradingChart.svelte';

  let coordinates = $state([]);
  let selectedTrendline = $state(null);

  function handleCoordinatesUpdate(data) {
    console.log('Coordinates updated:', data);
    coordinates = data.coordinates;
    selectedTrendline = data.selectedTrendline;
  }

  function formatDuration(timeSpan) {
    const hours = Math.floor(timeSpan / 3600);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${Math.floor(timeSpan / 60)} min`;
  }

  function getTrendlineIcon(priceChange) {
    return priceChange >= 0 ? '📈' : '📉';
  }

  function getTrendlineColor(priceChange) {
    return priceChange >= 0 ? 'text-green-400' : 'text-red-400';
  }
</script>

<svelte:head>
  <title>Trading Chart Test</title>
  <meta name="description" content="Professional interactive trading chart with draggable trendlines, real-time Binance data, and comprehensive analysis tools" />
</svelte:head>

{#if browser}
  <div class="min-h-screen bg-gray-900 text-white">
    <div class="max-w-7xl mx-auto p-4">
      <!-- Header -->
      <header class="mb-8 text-center">
        <div class="inline-flex items-center gap-3 mb-4">
          <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl">
            📊
          </div>
          <div>
            <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Interactive Trading Chart
            </h1>
            <p class="text-gray-400 text-lg">
              Professional trendline analysis with drag & drop functionality
            </p>
          </div>
        </div>
        
        <div class="flex flex-wrap justify-center gap-6 text-sm text-gray-400 bg-gray-800 rounded-lg p-4 max-w-5xl mx-auto">
          <div class="flex items-center gap-2">
            <span class="text-blue-400">🖱️</span>
            <span>Click twice to draw trendlines</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-green-400">👆</span>
            <span>Double-click to view coordinates</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-purple-400">🔄</span>
            <span>Drag endpoints or lines to move</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-red-400">🗑️</span>
            <span>Delete key to remove selected</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-orange-400">💾</span>
            <span>Auto-save to localStorage</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-cyan-400">🌐</span>
            <span>Real-time Binance data</span>
          </div>
        </div>
      </header>

      <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <!-- Main Chart -->
        <div class="xl:col-span-3">
          <TradingChart oncoordinatesupdate={handleCoordinatesUpdate} />
        </div>

        <!-- Sidebar -->
        <div class="xl:col-span-1 space-y-6">
          
          <!-- Selected Trendline Analysis -->
          {#if selectedTrendline}
            <div class="bg-gray-800 rounded-lg border border-gray-700">
              <div class="p-4 border-b border-gray-700">
                <h3 class="font-bold text-blue-400 flex items-center gap-2">
                  🎯 Selected Trendline
                </h3>
              </div>
              <div class="p-4 space-y-4">
                <div class="text-center p-3 bg-gray-700 rounded-lg">
                  <div class="text-2xl mb-2">
                    {getTrendlineIcon(selectedTrendline.end.price - selectedTrendline.start.price)}
                  </div>
                  <div class="text-lg font-bold {getTrendlineColor(selectedTrendline.end.price - selectedTrendline.start.price)}">
                    {selectedTrendline.end.price >= selectedTrendline.start.price ? 'BULLISH TREND' : 'BEARISH TREND'}
                  </div>
                </div>
                
                <div class="space-y-3 text-sm">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="bg-gray-700 p-3 rounded-lg">
                      <div class="text-gray-400 text-xs mb-1">Start Price</div>
                      <div class="font-bold">${selectedTrendline.start.price.toFixed(2)}</div>
                    </div>
                    <div class="bg-gray-700 p-3 rounded-lg">
                      <div class="text-gray-400 text-xs mb-1">End Price</div>
                      <div class="font-bold">${selectedTrendline.end.price.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div class="space-y-2">
                    <div class="flex justify-between items-center">
                      <span class="text-gray-400">Price Change:</span>
                      <span class="font-bold {getTrendlineColor(selectedTrendline.end.price - selectedTrendline.start.price)}">
                        ${(selectedTrendline.end.price - selectedTrendline.start.price).toFixed(2)}
                      </span>
                    </div>
                    
                    <div class="flex justify-between items-center">
                      <span class="text-gray-400">Percentage:</span>
                      <span class="font-bold {getTrendlineColor(selectedTrendline.end.price - selectedTrendline.start.price)}">
                        {(((selectedTrendline.end.price - selectedTrendline.start.price) / selectedTrendline.start.price) * 100).toFixed(2)}%
                      </span>
                    </div>
                    
                    <div class="flex justify-between items-center">
                      <span class="text-gray-400">Duration:</span>
                      <span class="font-medium">
                        {formatDuration(selectedTrendline.end.time - selectedTrendline.start.time)}
                      </span>
                    </div>
                  </div>
                  
                  <div class="border-t border-gray-600 pt-3">
                    <div class="text-xs text-gray-400 space-y-1">
                      <div><strong>Start:</strong> {new Date(selectedTrendline.start.time * 1000).toLocaleString()}</div>
                      <div><strong>End:</strong> {new Date(selectedTrendline.end.time * 1000).toLocaleString()}</div>
                      <div class="mt-2 text-yellow-400">💡 Double-click trendline to log coordinates</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- All Trendlines -->
          <div class="bg-gray-800 rounded-lg border border-gray-700">
            <div class="p-4 border-b border-gray-700">
              <h3 class="font-bold text-green-400 flex items-center justify-between">
                <span>📊 All Trendlines</span>
                <span class="bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                  {coordinates.length}
                </span>
              </h3>
            </div>
            <div class="p-4">
              {#if coordinates.length === 0}
                <div class="text-center py-8">
                  <div class="text-6xl mb-4 opacity-50">📈</div>
                  <p class="text-gray-500 text-lg font-medium mb-2">No trendlines drawn</p>
                  <p class="text-gray-600 text-sm">Click twice on the chart to start</p>
                </div>
              {:else}
                <div class="space-y-3 max-h-80 overflow-y-auto">
                  {#each coordinates as coord, index}
                    <div class="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 transition-colors border-l-4 {getTrendlineColor(coord.end.price - coord.start.price).replace('text-', 'border-')}">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <span class="text-lg">{getTrendlineIcon(coord.end.price - coord.start.price)}</span>
                          <span class="font-medium text-sm">Trendline {index + 1}</span>
                        </div>
                        <span class="text-xs text-gray-400">#{coord.id.slice(-4)}</span>
                      </div>
                      
                      <div class="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div class="text-gray-400">Change</div>
                          <div class="font-bold {getTrendlineColor(coord.end.price - coord.start.price)}">
                            {(((coord.end.price - coord.start.price) / coord.start.price) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div class="text-gray-400">Duration</div>
                          <div class="font-medium">
                            {formatDuration(coord.end.time - coord.start.time)}
                          </div>
                        </div>
                      </div>
                      
                      <div class="mt-2 text-xs text-gray-400">
                        ${coord.start.price.toFixed(2)} → ${coord.end.price.toFixed(2)}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <!-- Instructions -->
          <div class="bg-gray-800 rounded-lg border border-gray-700">
            <div class="p-4 border-b border-gray-700">
              <h3 class="font-bold text-yellow-400">📚 How to Use</h3>
            </div>
            <div class="p-4">
              <div class="space-y-3 text-sm">
                <div class="flex items-start gap-3 p-2 bg-gray-700 rounded">
                  <span class="text-blue-400 text-lg">🖱️</span>
                  <div>
                    <div class="font-medium">Draw Trendlines</div>
                    <div class="text-gray-400 text-xs">Click twice on chart to create trendline</div>
                  </div>
                </div>
                
                <div class="flex items-start gap-3 p-2 bg-gray-700 rounded">
                  <span class="text-purple-400 text-lg">🔄</span>
                  <div>
                    <div class="font-medium">Drag to Move</div>
                    <div class="text-gray-400 text-xs">Drag endpoints or entire line to reposition</div>
                  </div>
                </div>
                
                <div class="flex items-start gap-3 p-2 bg-gray-700 rounded">
                  <span class="text-green-400 text-lg">👆</span>
                  <div>
                    <div class="font-medium">View Coordinates</div>
                    <div class="text-gray-400 text-xs">Double-click trendline to log coordinates</div>
                  </div>
                </div>
                
                <div class="flex items-start gap-3 p-2 bg-gray-700 rounded">
                  <span class="text-red-400 text-lg">🗑️</span>
                  <div>
                    <div class="font-medium">Delete Trendlines</div>
                    <div class="text-gray-400 text-xs">Select and press Delete key</div>
                  </div>
                </div>
                
                <div class="flex items-start gap-3 p-2 bg-gray-700 rounded">
                  <span class="text-orange-400 text-lg">💾</span>
                  <div>
                    <div class="font-medium">Auto-Save</div>
                    <div class="text-gray-400 text-xs">Trendlines persist in localStorage</div>
                  </div>
                </div>
              </div>
              
              <div class="border-t border-gray-600 pt-3 mt-4">
                <div class="text-xs text-gray-400">
                  <div class="font-medium text-gray-300 mb-1">Keyboard Shortcuts:</div>
                  <div>• <kbd class="bg-gray-600 px-1 rounded">Delete</kbd> - Remove selected</div>
                  <div>• <kbd class="bg-gray-600 px-1 rounded">Escape</kbd> - Cancel drawing/dragging</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div class="text-center">
      <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <div class="text-lg">Loading Trading Chart...</div>
    </div>
  </div>
{/if}
