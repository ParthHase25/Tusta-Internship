Installation

1. Clone the repository

git clone <https://github.com/ParthHase25/Tusta-Internship>

cd interactive-trading-chart

2. Install dependencies

npm install

3. Start development server

npm run dev

4. Open in browser Navigate to http://localhost:5173


5. Production Build

npm run build
npm run preview


🎯 Features

1. Real-time Data: Live cryptocurrency prices from Binance API
2. Interactive Trendlines: Click twice to draw, persistent storage per trading pair
3. Multiple Assets: 10+ cryptocurrency pairs (BTC, ETH, SOL, etc.)
4. Multiple Timeframes: 1m to 1w intervals
5. Responsive Design: Works on desktop and mobile
6. Keyboard Shortcuts: Delete (remove), Escape (cancel)


Assumptions Made

1. Data Requirements

Binance API provides sufficient accuracy for analysis
200 candles per timeframe adequate for chart display
No real-time WebSocket needed (polling sufficient)

2. Storage Limitations

localStorage 5-10MB limit sufficient for typical usage
No cloud sync or multi-device support required
Browser-local storage acceptable for this use case


[View the deployed app on Vercel]

(https://tusta-internship.vercel.app/)