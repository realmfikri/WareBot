# WareBot

A minimal full-stack starter with a WebSocket backend and a grid-based simulator frontend.

## Project layout
- `server/`: Node.js WebSocket server that streams grid updates and accepts tile toggles.
- `client/`: Vite-powered frontend that renders the grid and communicates over WebSockets.

## Prerequisites
- Node.js 18+
- npm

## Getting started
### Backend
1. Install dependencies: `cd server && npm install`
2. Start the server: `npm run start`
3. The WebSocket endpoint listens on `ws://localhost:8080` by default.

### Frontend
1. Install dependencies: `cd client && npm install`
2. Start the dev server: `npm run dev`
3. Open the printed local URL (usually `http://localhost:5173`) in your browser. The app will connect to the backend at `ws://localhost:8080`.

### Linting
Run ESLint for each side:
- Backend: `cd server && npm run lint`
- Frontend: `cd client && npm run lint`

### Testing
- Backend unit and integration tests: `cd server && npm test`
- Frontend interaction tests: `cd client && npm test`

In CI environments, install and run each suite independently to keep caches separated:

```
npm ci --prefix server
npm test --prefix server

npm ci --prefix client
npm test --prefix client
```

## How it works
- The backend maintains a 10x10 grid of cells with random load values and broadcasts changes to all connected clients.
- Clients render the grid as interactive tiles. Clicking any tile sends a toggle message to the server, which updates the shared state and notifies every session.
