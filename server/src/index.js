const { createServer } = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const GRID_SIZE = 10;
const TICK_RATE_MS = 1500;

const grid = Array.from({ length: GRID_SIZE }, () =>
  Array.from({ length: GRID_SIZE }, () => ({
    active: Math.random() > 0.7,
    load: Math.floor(Math.random() * 100)
  }))
);

const server = createServer();
const wss = new WebSocketServer({ server });

function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  });
}

function serializeGrid() {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function toggleCell(x, y) {
  const cell = grid[y]?.[x];
  if (!cell) return null;

  cell.active = !cell.active;
  cell.load = Math.floor(Math.random() * 100);
  return cell;
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'state', grid: serializeGrid() }));

  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === 'toggle' && Number.isInteger(message.x) && Number.isInteger(message.y)) {
        const updatedCell = toggleCell(message.x, message.y);
        if (updatedCell) {
          broadcast({ type: 'cell', x: message.x, y: message.y, cell: updatedCell });
        }
      }
    } catch (error) {
      console.error('Failed to handle message', error);
    }
  });
});

setInterval(() => {
  const x = Math.floor(Math.random() * GRID_SIZE);
  const y = Math.floor(Math.random() * GRID_SIZE);
  const updated = toggleCell(x, y);
  if (updated) {
    broadcast({ type: 'cell', x, y, cell: updated });
  }
}, TICK_RATE_MS);

server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
